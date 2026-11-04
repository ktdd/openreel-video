import type {
  Clip,
  ExportProgress,
  ExportResult,
  MediaItem,
  MotionComposition,
  Project,
  Track,
  VideoExportSettings,
} from "@openreel/core";
import type { CreationProjectState } from "@openreel/core/creation/index";
import {
  DEFAULT_MOTION_INSTANCE_TRANSFORM,
  DEFAULT_VIDEO_SETTINGS,
  getExportEngine,
  MotionHighQualityRenderer,
  motionEngine,
  motionRenderer,
} from "@openreel/core";
import {
  createDownloadWritable,
  mimeForExt,
} from "../services/export-runner";
import { createWebMotionAssetResolver } from "./motion-asset-resolver";
import { createStoredZip, type ZipStoreEntry } from "./zip-store";

export interface ExportMotionCompositionFrameOptions {
  readonly composition: MotionComposition;
  readonly time: number;
  readonly compositionLibrary?: readonly MotionComposition[];
  readonly mediaItems?: readonly MediaItem[];
  readonly creation?: CreationProjectState;
  readonly filename?: string;
}

export interface ExportMotionCompositionFrameResult {
  readonly filename: string;
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly time: number;
}

export interface RenderMotionCompositionFrameToDataUrlOptions {
  readonly composition: MotionComposition;
  readonly time: number;
  readonly compositionLibrary?: readonly MotionComposition[];
  readonly mediaItems?: readonly MediaItem[];
  readonly creation?: CreationProjectState;
  readonly scale?: number;
}

export interface RenderMotionCompositionFrameToDataUrlResult {
  readonly dataUrl: string;
  readonly width: number;
  readonly height: number;
}

export type MotionExportFormat =
  | "mp4"
  | "webm-alpha"
  | "mov-prores4444"
  | "png-sequence";

export interface MotionExportFormatDescriptor {
  readonly id: MotionExportFormat;
  readonly label: string;
  readonly extension: "mp4" | "webm" | "mov" | "zip";
  readonly transparent: boolean;
}

export const MOTION_EXPORT_FORMATS: readonly MotionExportFormatDescriptor[] = [
  { id: "mp4", label: "MP4 (H.264)", extension: "mp4", transparent: false },
  {
    id: "webm-alpha",
    label: "WebM (VP9, transparent)",
    extension: "webm",
    transparent: true,
  },
  {
    id: "mov-prores4444",
    label: "MOV (ProRes 4444, transparent)",
    extension: "mov",
    transparent: true,
  },
  {
    id: "png-sequence",
    label: "PNG Sequence (ZIP, transparent)",
    extension: "zip",
    transparent: true,
  },
];

export type MotionExportResolutionScale = 1 | 0.5 | 0.25;

export interface MotionExportRange {
  readonly startTime: number;
  readonly endTime: number;
}

export interface ResolvedMotionExportRange {
  readonly startTime: number;
  readonly endTime: number;
  readonly startFrame: number;
  readonly endFrame: number;
  readonly frameCount: number;
}

export function resolveMotionExportRange(
  composition: MotionComposition,
  range: MotionExportRange | undefined,
): ResolvedMotionExportRange {
  const duration = Math.max(0, composition.duration);
  const frameRate = Math.max(1, composition.frameRate);
  const rawStart = range ? range.startTime : 0;
  const rawEnd = range ? range.endTime : duration;
  if (
    !Number.isFinite(rawStart) ||
    !Number.isFinite(rawEnd)
  ) {
    throw new Error("INVALID: motion export range must be finite.");
  }
  const startTime = Math.min(Math.max(rawStart, 0), duration);
  const endTime = Math.min(Math.max(rawEnd, 0), duration);
  if (!(startTime < endTime)) {
    throw new Error("INVALID: motion export range start must be before end.");
  }
  const startFrame = Math.round(startTime * frameRate);
  const endFrame = Math.round(endTime * frameRate);
  const frameCount = Math.max(1, endFrame - startFrame);
  return { startTime, endTime, startFrame, endFrame, frameCount };
}

const VALID_RESOLUTION_SCALES: readonly MotionExportResolutionScale[] = [
  1, 0.5, 0.25,
];

function resolveResolutionScale(
  scale: MotionExportResolutionScale | undefined,
): MotionExportResolutionScale {
  if (scale === undefined) return 1;
  if (!VALID_RESOLUTION_SCALES.includes(scale)) {
    throw new Error("INVALID: resolutionScale must be one of 1, 0.5, 0.25.");
  }
  return scale;
}

function scaleEncoderDimension(value: number, scale: number): number {
  const scaled = Math.max(2, Math.round(value * scale));
  return scaled % 2 === 0 ? scaled : scaled + 1;
}

export interface ExportMotionCompositionSceneOptions {
  readonly project: Project;
  readonly composition: MotionComposition;
  readonly compositionLibrary?: readonly MotionComposition[];
  readonly format?: MotionExportFormat;
  readonly filename?: string;
  readonly range?: MotionExportRange;
  readonly resolutionScale?: MotionExportResolutionScale;
  readonly isCanceled?: () => boolean;
  readonly mediaItems?: readonly MediaItem[];
  readonly creation?: CreationProjectState;
  readonly onProgress?: (progress: ExportProgress) => void;
}

export interface ExportMotionCompositionSceneResult {
  readonly filename: string;
  readonly width: number;
  readonly height: number;
  readonly duration: number;
  readonly framesRendered: number;
  readonly encodedFormat?: MotionExportFormat;
  readonly normalizedToH264?: boolean;
  readonly canceled?: boolean;
}

let motionFrameRenderer: MotionHighQualityRenderer | null = null;

function getMotionFrameRenderer(): MotionHighQualityRenderer {
  if (!motionFrameRenderer) {
    motionFrameRenderer = new MotionHighQualityRenderer(motionRenderer);
  }
  return motionFrameRenderer;
}

export async function exportMotionCompositionFramePng({
  composition,
  time,
  compositionLibrary = [composition],
  mediaItems = [],
  filename,
}: ExportMotionCompositionFrameOptions): Promise<ExportMotionCompositionFrameResult> {
  const safeTime = clampTime(time, composition.duration);
  const library = compositionLibrary.some(
    (candidate) => candidate.id === composition.id,
  )
    ? compositionLibrary
    : [composition, ...compositionLibrary];

  const bitmap = await getMotionFrameRenderer().render(composition, safeTime, {
    compositionLibrary: library,
    assetResolver: createWebMotionAssetResolver(mediaItems),
    supersample: 2,
  });

  try {
    const blob = await imageBitmapToPngBlob(bitmap);
    const resolvedFilename =
      filename ?? motionFrameExportFilename(composition, safeTime);
    triggerDownload(blob, resolvedFilename);
    return {
      filename: resolvedFilename,
      blob,
      width: composition.width,
      height: composition.height,
      time: safeTime,
    };
  } finally {
    bitmap.close();
  }
}

export async function renderMotionCompositionFrameToDataUrl({
  composition,
  time,
  compositionLibrary = [composition],
  mediaItems = [],
  scale,
}: RenderMotionCompositionFrameToDataUrlOptions): Promise<RenderMotionCompositionFrameToDataUrlResult> {
  const safeTime = clampTime(time, composition.duration);
  const supersample = clampSupersample(scale);
  const library = compositionLibrary.some(
    (candidate) => candidate.id === composition.id,
  )
    ? compositionLibrary
    : [composition, ...compositionLibrary];

  const bitmap = await getMotionFrameRenderer().render(composition, safeTime, {
    compositionLibrary: library,
    assetResolver: createWebMotionAssetResolver(mediaItems),
    supersample,
  });

  try {
    const blob = await imageBitmapToPngBlob(bitmap);
    const dataUrl = await blobToDataUrl(blob);
    return {
      dataUrl,
      width: composition.width,
      height: composition.height,
    };
  } finally {
    bitmap.close();
  }
}

function clampSupersample(scale: number | undefined): number {
  if (typeof scale !== "number" || !Number.isFinite(scale)) return 1;
  return Math.min(2, Math.max(1, scale));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Could not encode the motion frame as a data URL."));
      }
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read the motion frame blob."));
    reader.readAsDataURL(blob);
  });
}

function motionExportFormatRequiresNative(
  descriptor: MotionExportFormatDescriptor,
): boolean {
  if (descriptor.id === "png-sequence") return false;
  return descriptor.transparent || descriptor.extension === "mov";
}

function resolveEncodedMotionFormat(
  descriptor: MotionExportFormatDescriptor,
): { readonly format: MotionExportFormat; readonly normalizedToH264: boolean } {
  const willNormalize =
    motionExportFormatRequiresNative(descriptor);
  return willNormalize
    ? { format: "mp4", normalizedToH264: true }
    : { format: descriptor.id, normalizedToH264: false };
}

function buildMotionSceneExportSettings(
  project: Project,
  composition: MotionComposition,
  format: MotionExportFormat,
  resolutionScale: MotionExportResolutionScale,
): VideoExportSettings {
  const width = scaleEncoderDimension(composition.width, resolutionScale);
  const height = scaleEncoderDimension(composition.height, resolutionScale);
  const base: VideoExportSettings = {
    ...DEFAULT_VIDEO_SETTINGS,
    width,
    height,
    frameRate: composition.frameRate,
    bitrate: Math.max(8000, Math.round((width * height) / 180)),
    quality: 90,
    keyframeInterval: Math.max(1, Math.round(composition.frameRate * 2)),
    audioSettings: {
      ...DEFAULT_VIDEO_SETTINGS.audioSettings,
      sampleRate: project.settings.sampleRate as 44100 | 48000 | 96000,
      channels: project.settings.channels === 1 ? 1 : 2,
    },
  };
  if (format === "webm-alpha") {
    return { ...base, format: "webm", codec: "vp9", pixelFormat: "yuv444" };
  }
  if (format === "mov-prores4444") {
    return {
      ...base,
      format: "mov",
      codec: "prores",
      proresProfile: "4444",
      pixelFormat: "yuv444",
      colorDepth: 10,
    };
  }
  return { ...base, format: "mp4", codec: "h264", pixelFormat: "yuv420" };
}

function createExportProgress(
  phase: ExportProgress["phase"],
  progress: number,
  currentFrame: number,
  totalFrames: number,
  estimatedTimeRemaining: number = 0,
): ExportProgress {
  const safeProgress = Math.min(1, Math.max(0, progress));
  return {
    phase,
    progress: safeProgress,
    estimatedTimeRemaining: Math.max(0, estimatedTimeRemaining),
    currentFrame,
    totalFrames,
  };
}

export async function exportMotionCompositionScene({
  project,
  composition,
  compositionLibrary = project.motionCompositions ?? [composition],
  format = "mp4",
  filename,
  range,
  resolutionScale,
  isCanceled,
  mediaItems = [],
  creation,
  onProgress,
}: ExportMotionCompositionSceneOptions): Promise<ExportMotionCompositionSceneResult> {
  const requestedDescriptor =
    MOTION_EXPORT_FORMATS.find((entry) => entry.id === format) ??
    MOTION_EXPORT_FORMATS[0];
  const scale = resolveResolutionScale(resolutionScale);
  const resolvedRange = resolveMotionExportRange(composition, range);

  if (requestedDescriptor.id === "png-sequence") {
    const pngFilename =
      filename ??
      motionSceneExportFilename(composition, requestedDescriptor.extension);
    return exportMotionCompositionScenePngSequence({
      project,
      composition,
      compositionLibrary,
      descriptor: requestedDescriptor,
      resolvedFilename: pngFilename,
      resolvedRange,
      scale,
      mediaItems,
      creation,
      isCanceled,
      onProgress,
    });
  }

  const { format: encodedFormat, normalizedToH264 } =
    resolveEncodedMotionFormat(requestedDescriptor);
  const descriptor =
    MOTION_EXPORT_FORMATS.find((entry) => entry.id === encodedFormat) ??
    requestedDescriptor;
  const resolvedFilename =
    filename ?? motionSceneExportFilename(composition, descriptor.extension);

  const exportProject = createMotionCompositionExportProject(
    project,
    composition,
    compositionLibrary,
    resolvedRange,
  );
  const settings = buildMotionSceneExportSettings(
    project,
    composition,
    encodedFormat,
    scale,
  );
  const writable = await createDownloadWritable(
    resolvedFilename,
    mimeForExt(descriptor.extension),
  );
  const engine = getExportEngine();
  await engine.initialize();

  const generator = engine.exportVideo(exportProject, settings, writable);
  let finalResult: ExportResult | undefined;
  let canceled = false;
  let completed = false;

  try {
    while (true) {
      if (isCanceled?.()) {
        canceled = true;
        break;
      }
      const next = await generator.next();
      if (next.done) {
        finalResult = next.value;
        completed = true;
        break;
      }
      onProgress?.(next.value);
    }
  } finally {
    if (!completed) {
      await generator.return({ success: false }).catch(() => undefined);
      await writable.abort().catch(() => undefined);
    }
  }

  if (canceled) {
    return {
      filename: resolvedFilename,
      width: settings.width,
      height: settings.height,
      duration: resolvedRange.endTime - resolvedRange.startTime,
      framesRendered: 0,
      encodedFormat,
      ...(normalizedToH264 ? { normalizedToH264: true } : {}),
      canceled: true,
    };
  }

  if (!finalResult?.success) {
    throw new Error(finalResult?.error?.message ?? "Motion scene export failed.");
  }

  return {
    filename: resolvedFilename,
    width: settings.width,
    height: settings.height,
    duration: composition.duration,
    framesRendered: finalResult.stats?.framesRendered ?? 0,
    encodedFormat,
    ...(normalizedToH264 ? { normalizedToH264: true } : {}),
  };
}

interface ExportPngSequenceParams {
  readonly project: Project;
  readonly composition: MotionComposition;
  readonly compositionLibrary: readonly MotionComposition[];
  readonly descriptor: MotionExportFormatDescriptor;
  readonly resolvedFilename: string;
  readonly resolvedRange: ResolvedMotionExportRange;
  readonly scale: MotionExportResolutionScale;
  readonly mediaItems: readonly MediaItem[];
  readonly creation?: CreationProjectState;
  readonly isCanceled?: () => boolean;
  readonly onProgress?: (progress: ExportProgress) => void;
}

async function exportMotionCompositionScenePngSequence({
  composition,
  compositionLibrary,
  descriptor,
  resolvedFilename,
  resolvedRange,
  scale,
  mediaItems,
  isCanceled,
  onProgress,
}: ExportPngSequenceParams): Promise<ExportMotionCompositionSceneResult> {
  const library = compositionLibrary.some(
    (candidate) => candidate.id === composition.id,
  )
    ? compositionLibrary
    : [composition, ...compositionLibrary];
  const assetResolver = createWebMotionAssetResolver(mediaItems);
  const supersample = clampSupersample(scale * 2);
  const frameRate = Math.max(1, composition.frameRate);
  const totalFrames = resolvedRange.frameCount;
  const entries: ZipStoreEntry[] = [];
  const outputWidth = scaleEncoderDimension(composition.width, scale);
  const outputHeight = scaleEncoderDimension(composition.height, scale);
  const pngTarget =
    scale === 1
      ? undefined
      : { width: outputWidth, height: outputHeight };

  onProgress?.(createExportProgress("preparing", 0, 0, totalFrames));

  for (let offset = 0; offset < totalFrames; offset += 1) {
    if (isCanceled?.()) {
      return {
        filename: resolvedFilename,
        width: outputWidth,
        height: outputHeight,
        duration: resolvedRange.endTime - resolvedRange.startTime,
        framesRendered: offset,
        encodedFormat: descriptor.id,
        canceled: true,
      };
    }
    const frameIndex = resolvedRange.startFrame + offset;
    const frameTime = clampTime(frameIndex / frameRate, composition.duration);
    const bitmap = await getMotionFrameRenderer().render(composition, frameTime, {
      compositionLibrary: library,
      assetResolver,
      supersample,
    });
    try {
      const blob = await imageBitmapToPngBlob(bitmap, pngTarget);
      const data = new Uint8Array(await blob.arrayBuffer());
      const name = `frame-${(offset + 1).toString().padStart(5, "0")}.png`;
      entries.push({ name, data });
    } finally {
      bitmap.close();
    }
    onProgress?.(
      createExportProgress(
        "rendering",
        (offset + 1) / totalFrames,
        offset + 1,
        totalFrames,
      ),
    );
  }

  if (isCanceled?.()) {
    return {
      filename: resolvedFilename,
      width: outputWidth,
      height: outputHeight,
      duration: resolvedRange.endTime - resolvedRange.startTime,
      framesRendered: entries.length,
      encodedFormat: descriptor.id,
      canceled: true,
    };
  }

  const zipBytes = createStoredZip(entries);
  const writable = await createDownloadWritable(
    resolvedFilename,
    mimeForExt(descriptor.extension),
  );
  try {
    await writable.write(new Blob([zipBytes], { type: "application/zip" }));
  } finally {
    await writable.close();
  }
  onProgress?.(
    createExportProgress("complete", 1, totalFrames, totalFrames),
  );

  return {
    filename: resolvedFilename,
    width: outputWidth,
    height: outputHeight,
    duration: resolvedRange.endTime - resolvedRange.startTime,
    framesRendered: entries.length,
    encodedFormat: descriptor.id,
  };
}

export const exportMotionCompositionSceneMp4 = exportMotionCompositionScene;

export function motionFrameExportFilename(
  composition: MotionComposition,
  time: number,
): string {
  const frame = Math.round(Math.max(0, time) * composition.frameRate)
    .toString()
    .padStart(5, "0");
  return `${sanitizeFilenamePart(composition.name)}-frame-${frame}.png`;
}

export function motionSceneExportFilename(
  composition: MotionComposition,
  ext: MotionExportFormatDescriptor["extension"] = "mp4",
): string {
  return `${sanitizeFilenamePart(composition.name)}.${ext}`;
}

function createMotionCompositionExportProject(
  project: Project,
  composition: MotionComposition,
  compositionLibrary: readonly MotionComposition[],
  resolvedRange: ResolvedMotionExportRange,
): Project {
  const library = compositionLibrary.some(
    (candidate) => candidate.id === composition.id,
  )
    ? compositionLibrary
    : [composition, ...compositionLibrary];
  const rangeDuration = resolvedRange.endTime - resolvedRange.startTime;
  const instanceStartTime =
    resolvedRange.startTime === 0 ? 0 : -resolvedRange.startTime;
  const instanceDuration =
    resolvedRange.startTime === 0 && resolvedRange.endTime === composition.duration
      ? composition.duration
      : resolvedRange.endTime;
  const instance = motionEngine.createInstance(composition, {
    startTime: instanceStartTime,
    duration: instanceDuration,
    name: composition.name,
  });
  const audioTracks = buildMotionAudioTracks(project, composition);
  const exportProject: Project = {
    ...project,
    id: `${project.id}-motion-export-${composition.id}`,
    name: composition.name,
    settings: {
      ...project.settings,
      width: composition.width,
      height: composition.height,
      frameRate: composition.frameRate,
    },
    timeline: {
      ...project.timeline,
      tracks: audioTracks,
      duration: rangeDuration,
      markers: [],
      subtitles: [],
    },
    motionCompositions: [...library],
    motionInstances: [],
  };
  return motionEngine.insertInstance(exportProject, instance);
}

function buildMotionAudioTracks(
  project: Project,
  composition: MotionComposition,
): Track[] {
  const audioClips = composition.audioClips ?? [];
  const clips: Clip[] = [];
  const trackId = `motion-audio-${composition.id}`;
  for (const audioClip of audioClips) {
    if (audioClip.muted) continue;
    const mediaId = audioClip.mediaId ?? audioClip.assetId;
    if (!mediaId) continue;
    const media = project.mediaLibrary.items.find((item) => item.id === mediaId);
    if (!media) continue;
    const trimStart = Math.max(0, audioClip.trimStart ?? 0);
    const duration = Math.max(0, audioClip.duration);
    if (duration <= 0) continue;
    clips.push({
      id: `${audioClip.id}-export`,
      mediaId,
      trackId,
      startTime: Math.max(0, audioClip.startTime),
      duration,
      inPoint: trimStart,
      outPoint: trimStart + duration,
      effects: [],
      audioEffects: [],
      transform: DEFAULT_MOTION_INSTANCE_TRANSFORM,
      volume: audioClip.gain ?? 1,
      fade:
        audioClip.fadeIn || audioClip.fadeOut
          ? { fadeIn: audioClip.fadeIn ?? 0, fadeOut: audioClip.fadeOut ?? 0 }
          : undefined,
      keyframes: [],
    });
  }
  if (clips.length === 0) return [];
  return [
    {
      id: trackId,
      type: "audio",
      name: "Motion Audio",
      clips,
      transitions: [],
      locked: false,
      hidden: false,
      muted: false,
      solo: false,
    },
  ];
}

async function imageBitmapToPngBlob(
  bitmap: ImageBitmap,
  target?: { readonly width: number; readonly height: number },
): Promise<Blob> {
  const width = target?.width ?? bitmap.width;
  const height = target?.height ?? bitmap.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create a canvas for motion frame export.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Could not encode the motion frame as PNG."));
      }
    }, "image/png");
  });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function sanitizeFilenamePart(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || "motion-scene";
}

function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(time)) return 0;
  return Math.min(Math.max(time, 0), Math.max(duration, 0));
}
