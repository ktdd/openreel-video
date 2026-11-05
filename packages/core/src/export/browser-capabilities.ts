import { CODEC_MAP, type AudioExportSettings, type VideoExportSettings } from "./types";
import type { Project } from "../types/project";

type MediaBunnyModule = typeof import("mediabunny");

export interface BrowserExportCapability {
  supported: boolean;
  reason: string | null;
  audioCodec?: string;
}

export function getVideoExportValidationError(settings: VideoExportSettings, duration: number): string | null {
  if (!Number.isFinite(duration) || duration <= 0) return "Add a clip, text, or graphics to the timeline before exporting.";
  if (![settings.width, settings.height].every((value) => Number.isInteger(value) && value > 0)) return "Choose a valid width and height for your video.";
  if (!Number.isFinite(settings.frameRate) || settings.frameRate <= 0) return "Choose a valid frame rate for your video.";
  if (!Number.isFinite(settings.bitrate) || settings.bitrate <= 0) return "Choose a valid video bitrate.";
  return null;
}

export function getAudioExportValidationError(settings: AudioExportSettings, duration: number): string | null {
  if (!Number.isFinite(duration) || duration <= 0) return "Add audio to the timeline before exporting.";
  if (!["wav", "mp3", "aac", "flac", "ogg", "opus"].includes(settings.format)) return "Choose a valid audio format.";
  if (![44100, 48000, 96000].includes(settings.sampleRate)) return "Choose a valid audio sample rate.";
  if (settings.format === "mp3" && settings.sampleRate > 48000) return "MP3 requires a sample rate of 44.1 or 48 kHz.";
  if (settings.format === "opus" && settings.sampleRate !== 48000) return "Opus export uses a 48 kHz sample rate.";
  if (settings.channels !== 1 && settings.channels !== 2) return "Choose mono or stereo audio.";
  if (![16, 24, 32].includes(settings.bitDepth)) return "Choose a valid audio bit depth.";
  if (settings.format !== "wav" && settings.format !== "flac"
    && (!Number.isFinite(settings.bitrate) || settings.bitrate <= 0)) return "Choose a valid audio bitrate.";
  const range = settings.range;
  if (range && (!Number.isFinite(range.startTime) || !Number.isFinite(range.endTime)
    || range.startTime < 0 || range.endTime <= range.startTime || range.endTime > duration + 1e-7)) {
    return "Choose an In/Out range inside the timeline, with Out after In.";
  }
  return null;
}

/** Check the originals, even when preview playback uses a proxy. */
export function getMissingExportMedia(project: Project, range?: VideoExportSettings["range"]): string[] {
  const referenced = new Set(project.timeline.tracks.flatMap((track) => track.clips
    .filter((clip) => !range || (clip.startTime < range.endTime && clip.startTime + clip.duration > range.startTime))
    .map((clip) => clip.mediaId)));
  return [...referenced].flatMap((id) => {
    const item = project.mediaLibrary.items.find((candidate) => candidate.id === id);
    if (!item) return [id];
    if (["video", "audio", "image"].includes(item.type) && (!item.blob || item.isPlaceholder)) return [item.name || id];
    return [];
  });
}

/** Probe the selected codec and container, without silently changing the video codec. */
export async function checkBrowserExportCapability(
  settings: VideoExportSettings,
  mediaBunny?: MediaBunnyModule,
  includeAudio = true,
): Promise<BrowserExportCapability> {
  if (settings.codec === "prores" || (settings.colorDepth ?? 8) > 8 || (settings.pixelFormat && settings.pixelFormat !== "yuv420")) {
    return { supported: false, reason: "ProRes, transparency, and high bit depth are unsupported by this browser export. Choose H.264." };
  }
  try {
    const library = mediaBunny ?? await import("mediabunny");
    const format = settings.format === "webm" ? new library.WebMOutputFormat() : settings.format === "mov" ? new library.MovOutputFormat() : new library.Mp4OutputFormat();
    const codec = CODEC_MAP[settings.codec];
    if (!format.getSupportedVideoCodecs().includes(codec)) {
      return { supported: false, reason: `${settings.codec.toUpperCase()} cannot be exported in ${settings.format.toUpperCase()}. Choose VP9 for WebM or H.264 for MP4.` };
    }
    const video = await library.getFirstEncodableVideoCodec([codec], {
      width: settings.width, height: settings.height, bitrate: settings.bitrate * 1000,
    });
    if (video !== codec) return { supported: false, reason: `This browser cannot encode ${settings.codec.toUpperCase()} at ${settings.width}×${settings.height}. Try H.264 / MP4, VP9 / WebM, or a smaller resolution.` };
    if (!includeAudio) return { supported: true, reason: null };
    const audioCodec = await library.getFirstEncodableAudioCodec(format.getSupportedAudioCodecs(), {
      numberOfChannels: settings.audioSettings.channels,
      sampleRate: settings.audioSettings.sampleRate,
      bitrate: settings.audioSettings.bitrate * 1000,
    });
    if (!audioCodec) return { supported: false, reason: `This browser cannot encode audio for ${settings.format.toUpperCase()}. Try WebM with Opus audio or another browser.` };
    return { supported: true, reason: null, audioCodec };
  } catch (error) {
    return { supported: false, reason: `Could not check browser export support: ${error instanceof Error ? error.message : "encoder unavailable"}` };
  }
}
