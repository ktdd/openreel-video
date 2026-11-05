import { describe, expect, it, vi } from "vitest";
import { FFmpegFallback } from "./ffmpeg-fallback";

function setup() {
  const fallback = new FFmpegFallback();
  const load = vi.spyOn(fallback, "load").mockResolvedValue();
  const ffmpeg = {
    writeFile: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn(async (_args: string[]) => 0),
    readFile: vi.fn(async (_filename: string) => new Uint8Array([1, 2, 3])),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    terminate: vi.fn(), on: vi.fn(), off: vi.fn(),
  };
  Object.assign(fallback, { ffmpeg, loaded: true });
  return { fallback, ffmpeg, load };
}

describe("FFmpeg compressed audio export fallback", () => {
  it.each([
    { format: "mp3", codec: "libmp3lame", mime: "audio/mpeg" },
    { format: "aac", codec: "aac", mime: "audio/aac" },
    { format: "ogg", codec: "libvorbis", mime: "audio/ogg" },
    { format: "opus", codec: "libopus", mime: "audio/ogg; codecs=opus" },
  ] as const)("encodes $format using $codec, the requested audio settings and a matching extension/MIME", async ({ format, codec, mime }) => {
    const { fallback, ffmpeg } = setup();
    const blob = await fallback.convertAudio(new Blob(["mixed audio"]), format, { bitrate: "128k", sampleRate: 48000, channels: 1 });
    const args = ffmpeg.exec.mock.calls[0][0];
    expect(args.slice(0, 5)).toEqual(["-i", expect.stringMatching(/^audio_.*_input\.wav$/), "-vn", "-c:a", codec]);
    for (const [flag, value] of [["-b:a", "128k"], ["-ar", "48000"], ["-ac", "1"]]) {
      expect(args[args.indexOf(flag) + 1]).toBe(value);
    }
    expect(args.at(-1)).toMatch(new RegExp(`\\.${format}$`));
    if (format === "opus") expect(args).toEqual(expect.arrayContaining(["-f", "ogg"]));
    expect(blob.type).toBe(mime);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(ffmpeg.deleteFile).toHaveBeenCalledWith(args[1]);
    expect(ffmpeg.deleteFile).toHaveBeenCalledWith(args.at(-1));
  });

  it("rejects encoder failures without reading or returning leftover output", async () => {
    const { fallback, ffmpeg } = setup();
    ffmpeg.exec.mockResolvedValueOnce(1);
    await expect(fallback.convertAudio(new Blob(["audio"]), "mp3")).rejects.toThrow("FFmpeg exited with 1");
    expect(ffmpeg.readFile).not.toHaveBeenCalled();
    expect(ffmpeg.deleteFile).toHaveBeenCalledTimes(2);
  });

  it("rejects an empty encoded file", async () => {
    const { fallback, ffmpeg } = setup();
    ffmpeg.readFile.mockResolvedValueOnce(new Uint8Array());
    await expect(fallback.convertAudio(new Blob(["audio"]), "aac")).rejects.toThrow("empty file");
    expect(ffmpeg.deleteFile).toHaveBeenCalledTimes(2);
  });

  it("copies only the encoded output view, not padding from its backing buffer", async () => {
    const { fallback, ffmpeg } = setup();
    ffmpeg.readFile.mockResolvedValueOnce(new Uint8Array([99, 1, 2, 99]).subarray(1, 3));
    const blob = await fallback.convertAudio(new Blob(["audio"]), "opus");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
  });

  it("isolates temporary files across audio conversions", async () => {
    const { fallback, ffmpeg } = setup();
    await Promise.all((["mp3", "aac"] as const).map((format) => fallback.convertAudio(new Blob(["audio"]), format)));
    expect(new Set(ffmpeg.writeFile.mock.calls.map(([filename]) => filename)).size).toBe(2);
    expect(new Set(ffmpeg.readFile.mock.calls.map(([filename]) => filename)).size).toBe(2);
    expect(ffmpeg.deleteFile).toHaveBeenCalledTimes(4);
  });

  it("does not load or encode when already cancelled", async () => {
    const { fallback, ffmpeg, load } = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(fallback.convertAudio(new Blob(["audio"]), "mp3", { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(load).not.toHaveBeenCalled();
    expect(ffmpeg.exec).not.toHaveBeenCalled();
  });

  it("terminates a cancelled conversion, never reads output and removes its abort listener", async () => {
    const { fallback, ffmpeg } = setup();
    let rejectEncoding!: (error: Error) => void;
    ffmpeg.exec.mockImplementationOnce(() => new Promise<number>((_resolve, reject) => { rejectEncoding = reject; }));
    ffmpeg.terminate.mockImplementation(() => rejectEncoding(new Error("Worker terminated")));
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");
    const operation = fallback.convertAudio(new Blob(["audio"]), "mp3", { signal: controller.signal });
    const failure = expect(operation).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(ffmpeg.exec).toHaveBeenCalledOnce());
    controller.abort();
    await failure;
    expect(ffmpeg.terminate).toHaveBeenCalledOnce();
    expect(ffmpeg.readFile).not.toHaveBeenCalled();
    expect(fallback.isLoaded()).toBe(false);
    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });
});
