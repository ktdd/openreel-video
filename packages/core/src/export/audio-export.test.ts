import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioExportSettings, ExportResult } from "./types";
import type { Project } from "../types";

const mocks = vi.hoisted(() => ({
  renderAudio: vi.fn(), renderFrame: vi.fn(), canEncodeAudio: vi.fn(),
  sourceAdd: vi.fn(), sourceClose: vi.fn(), sampleClose: vi.fn(),
  finalize: vi.fn(), cancelOutput: vi.fn(), samples: vi.fn(),
  sourceConfigs: [] as { codec: string; bitrate: number }[],
  outputFormats: [] as { fileExtension: string }[],
  convertAudio: vi.fn(), createFFmpeg: vi.fn(), terminateFFmpeg: vi.fn(), sharedFFmpeg: vi.fn(),
}));

vi.mock("../video/video-engine", () => ({
  VideoEngine: vi.fn(),
  getVideoEngine: () => ({ isInitialized: () => true, initialize: vi.fn(), renderFrame: mocks.renderFrame }),
}));
vi.mock("../audio/audio-engine", () => ({
  AudioEngine: vi.fn(),
  getAudioEngine: () => ({ isInitialized: () => true, initialize: vi.fn(), renderAudio: mocks.renderAudio }),
}));
vi.mock("../media/mediabunny-engine", () => ({ getMediaEngine: vi.fn() }));
vi.mock("../text/title-engine", () => ({ titleEngine: { getAllTextClips: () => [] } }));
vi.mock("../graphics/graphics-engine", () => ({ graphicsEngine: {
  getAllShapeClips: () => [], getAllSVGClips: () => [], getAllStickerClips: () => [],
} }));
vi.mock("../media/ffmpeg-fallback", () => ({
  FFmpegFallback: class {
    constructor() { mocks.createFFmpeg(); }
    convertAudio = mocks.convertAudio;
    terminate = mocks.terminateFFmpeg;
  },
  getFFmpegFallback: mocks.sharedFFmpeg,
}));
vi.mock("mediabunny", async (importOriginal) => {
  const actual = await importOriginal<typeof import("mediabunny")>();
  return {
    ...actual,
    canEncodeAudio: mocks.canEncodeAudio,
    Output: class {
      constructor(private options: { format: { fileExtension: string }; target: { buffer: ArrayBuffer | null } }) {
        mocks.outputFormats.push(options.format);
      }
      addAudioTrack = vi.fn();
      start = vi.fn().mockResolvedValue(undefined);
      cancel = mocks.cancelOutput;
      async finalize() {
        await mocks.finalize();
        this.options.target.buffer = new Uint8Array([10, 20, 30]).buffer;
      }
    },
    AudioSampleSource: class {
      constructor(config: { codec: string; bitrate: number }) { mocks.sourceConfigs.push(config); }
      add = mocks.sourceAdd;
      close = mocks.sourceClose;
    },
    AudioSample: { fromAudioBuffer: mocks.samples },
  };
});

import { ExportEngine } from "./export-engine";

function project(): Project {
  return {
    id: "audio-project", name: "Audio", createdAt: 0, modifiedAt: 0,
    settings: { width: 1920, height: 1080, frameRate: 30, sampleRate: 48000, channels: 2 },
    mediaLibrary: { items: [{
      id: "media", name: "Original.wav", type: "audio", fileHandle: null, blob: new Blob(["original"]), thumbnailUrl: null, waveformData: null,
      metadata: { duration: 10, width: 0, height: 0, frameRate: 0, codec: "pcm", sampleRate: 48000, channels: 2, fileSize: 8, hasAudio: true, hasVideo: false },
    }] },
    timeline: { duration: 10, subtitles: [], markers: [], tracks: [{
      id: "track", name: "Audio", type: "video", hidden: false, muted: false, locked: false, solo: false, transitions: [],
      clips: [{ id: "clip", mediaId: "media", trackId: "track", startTime: 0, duration: 10, inPoint: 0, outPoint: 10,
        effects: [], audioEffects: [], keyframes: [], volume: 1,
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, anchor: { x: 0.5, y: 0.5 }, opacity: 1 },
      }],
    }] },
  };
}

function audioBuffer(channels: number, sampleRate: number): AudioBuffer {
  return { numberOfChannels: channels, sampleRate, length: 4,
    getChannelData: () => new Float32Array([-1, 0, 0.5, 1]),
  } as unknown as AudioBuffer;
}

async function drain(engine: ExportEngine, settings: Partial<AudioExportSettings>, source = project()): Promise<ExportResult> {
  const generator = engine.exportAudio(source, settings);
  for (;;) {
    const next = await generator.next();
    if (next.done) return next.value;
  }
}

let engine: ExportEngine;
beforeEach(async () => {
  vi.resetAllMocks();
  mocks.sourceConfigs.length = 0;
  mocks.outputFormats.length = 0;
  mocks.canEncodeAudio.mockResolvedValue(true);
  mocks.sourceAdd.mockResolvedValue(undefined);
  mocks.finalize.mockResolvedValue(undefined);
  mocks.cancelOutput.mockResolvedValue(undefined);
  mocks.samples.mockReturnValue([{ close: mocks.sampleClose }, { close: mocks.sampleClose }]);
  mocks.renderAudio.mockImplementation(async (source: Project) => ({ buffer: audioBuffer(source.settings.channels, source.settings.sampleRate) }));
  mocks.convertAudio.mockResolvedValue(new Blob(["compressed fallback"], { type: "audio/mpeg" }));
  engine = new ExportEngine();
  await engine.initialize();
});
afterEach(() => { engine.dispose(); });

describe("audio-only export encoding", () => {
  it.each(([16, 24, 32] as const).flatMap((bitDepth) => ([1, 2] as const).map((channels) => ({ bitDepth, channels }))))(
    "writes a real $bitDepth-bit WAV with $channels channels without invoking compressed encoders",
    async ({ bitDepth, channels }) => {
      const result = await drain(engine, { format: "wav", bitDepth, channels, sampleRate: 96000 });
      expect(result.success).toBe(true);
      expect(result.blob?.type).toBe("audio/wav");
      const bytes = await result.blob!.arrayBuffer();
      const header = new DataView(bytes);
      expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
      expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
      expect(header.getUint16(20, true)).toBe(bitDepth === 32 ? 3 : 1);
      expect(header.getUint16(22, true)).toBe(channels);
      expect(header.getUint32(24, true)).toBe(96000);
      expect(header.getUint16(34, true)).toBe(bitDepth);
      expect(bytes.byteLength).toBe(44 + 4 * channels * bitDepth / 8);
      if (bitDepth === 32) expect(header.getFloat32(44, true)).toBe(-1);
      expect(mocks.canEncodeAudio).not.toHaveBeenCalled();
      expect(mocks.createFFmpeg).not.toHaveBeenCalled();
      expect(mocks.renderFrame).not.toHaveBeenCalled();
    },
  );

  it.each([
    { format: "mp3", codec: "mp3", extension: ".mp3", mime: "audio/mpeg" },
    { format: "aac", codec: "aac", extension: ".aac", mime: "audio/aac" },
    { format: "ogg", codec: "vorbis", extension: ".ogg", mime: "audio/ogg" },
    { format: "opus", codec: "opus", extension: ".ogg", mime: "audio/ogg; codecs=opus" },
  ] as const)("uses the exact $codec codec and $format container/MIME when browser encoding is available", async ({ format, codec, extension, mime }) => {
    const result = await drain(engine, { format, channels: 1, sampleRate: 48000, bitrate: 128 });
    expect(result.success).toBe(true);
    expect(result.blob?.type).toBe(mime);
    expect(new Uint8Array(await result.blob!.arrayBuffer())).toEqual(new Uint8Array([10, 20, 30]));
    expect(mocks.canEncodeAudio).toHaveBeenCalledWith(codec, { numberOfChannels: 1, sampleRate: 48000, bitrate: 128000 });
    expect(mocks.sourceConfigs).toEqual([{ codec, bitrate: 128000 }]);
    expect(mocks.outputFormats[0].fileExtension).toBe(extension);
    expect(mocks.sourceClose).toHaveBeenCalledOnce();
    expect(mocks.sampleClose).toHaveBeenCalledTimes(2);
    expect(mocks.createFFmpeg).not.toHaveBeenCalled();
    expect(mocks.renderFrame).not.toHaveBeenCalled();
  });

  it.each(["mp3", "aac", "ogg", "opus"] as const)("falls back to dedicated FFmpeg for unsupported %s instead of returning disguised WAV", async (format) => {
    mocks.canEncodeAudio.mockResolvedValue(false);
    const encoded = new Blob(["encoded compressed bytes"]);
    mocks.convertAudio.mockResolvedValue(encoded);
    const result = await drain(engine, { format, channels: 1, sampleRate: 48000, bitrate: 128 });
    expect(result.success).toBe(true);
    expect(result.blob).toBe(encoded);
    expect(mocks.convertAudio).toHaveBeenCalledWith(expect.any(Blob), format, {
      bitrate: "128k", sampleRate: 48000, channels: 1, signal: expect.any(AbortSignal),
    });
    const input = mocks.convertAudio.mock.calls[0][0] as Blob;
    const header = new DataView(await input.arrayBuffer());
    expect(header.getUint16(20, true)).toBe(3);
    expect(header.getUint16(34, true)).toBe(32);
    expect(mocks.createFFmpeg).toHaveBeenCalledOnce();
    expect(mocks.sharedFFmpeg).not.toHaveBeenCalled();
    expect(mocks.sourceAdd).not.toHaveBeenCalled();
  });

  it("renders only the marked audio range at the chosen sample rate and channel count", async () => {
    const result = await drain(engine, { format: "wav", bitDepth: 32, channels: 1, sampleRate: 96000, range: { startTime: 2, endTime: 4 } });
    expect(result.success).toBe(true);
    expect(mocks.renderAudio).toHaveBeenCalledWith(expect.objectContaining({ settings: expect.objectContaining({ channels: 1, sampleRate: 96000 }) }), 2, 2);
    expect(result.stats?.averageBitrate).toBe(result.blob!.size * 8 / 2);
  });

  it("rejects missing original audio before rendering or loading an encoder", async () => {
    const source = project();
    source.mediaLibrary.items[0] = { ...source.mediaLibrary.items[0], blob: null, isPlaceholder: true };
    const result = await drain(engine, { format: "mp3" }, source);
    expect(result).toMatchObject({ success: false, error: { code: "INVALID_SETTINGS", message: expect.stringContaining("Original.wav") } });
    expect(mocks.renderAudio).not.toHaveBeenCalled();
    expect(mocks.canEncodeAudio).not.toHaveBeenCalled();
    expect(mocks.createFFmpeg).not.toHaveBeenCalled();
  });

  it("rejects invalid marks before rendering and does not silently export the full timeline", async () => {
    const result = await drain(engine, { format: "wav", range: { startTime: 2, endTime: 11 } });
    expect(result).toMatchObject({ success: false, error: { code: "INVALID_SETTINGS" } });
    expect(mocks.renderAudio).not.toHaveBeenCalled();
  });

  it("reports a native encoder failure, closes samples and cancels output without substituting WAV", async () => {
    mocks.sourceAdd.mockRejectedValueOnce(new Error("Native encoder failed"));
    const result = await drain(engine, { format: "aac" });
    expect(result).toMatchObject({ success: false, error: { code: "AUDIO_ENCODE_FAILED", message: "Native encoder failed" } });
    expect(result.blob).toBeUndefined();
    expect(mocks.sampleClose).toHaveBeenCalledTimes(2);
    expect(mocks.cancelOutput).toHaveBeenCalled();
    expect(mocks.createFFmpeg).not.toHaveBeenCalled();
  });

  it("cancels native audio encoding without returning a blob and permits a retry", async () => {
    mocks.sourceAdd.mockImplementationOnce(async () => { engine.cancel(); });
    const result = await drain(engine, { format: "opus" });
    expect(result).toMatchObject({ success: false, error: { code: "CANCELLED" } });
    expect(result.blob).toBeUndefined();
    expect(mocks.cancelOutput).toHaveBeenCalled();
    expect(mocks.sampleClose).toHaveBeenCalledTimes(2);
    expect((await drain(engine, { format: "opus" })).success).toBe(true);
  });

  it("propagates cancellation to the dedicated fallback without using the shared transcoder", async () => {
    mocks.canEncodeAudio.mockResolvedValue(false);
    mocks.convertAudio.mockImplementationOnce(async (_input: Blob, _format: string, options: { signal: AbortSignal }) => {
      engine.cancel();
      expect(options.signal.aborted).toBe(true);
      throw new DOMException("Cancelled", "AbortError");
    });
    expect(await drain(engine, { format: "mp3" })).toMatchObject({ success: false, error: { code: "CANCELLED" } });
    expect(mocks.sharedFFmpeg).not.toHaveBeenCalled();
    expect((await drain(engine, { format: "mp3" })).success).toBe(true);
  });
});
