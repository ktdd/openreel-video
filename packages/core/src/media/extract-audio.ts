export interface ExtractAudioProgressOptions {
  onProgress?: (progress: { phase?: string; progress: number }) => void;
}

// Extract audio locally using the FFmpeg WASM backend.
export async function extractAudioWav(
  file: File | Blob,
  audioTrackIndex = 0,
  options?: ExtractAudioProgressOptions,
): Promise<Blob> {
  const { getFFmpegFallback } = await import("./ffmpeg-fallback");
  return getFFmpegFallback().extractAudioAsWav(
    file,
    audioTrackIndex,
    options as Parameters<ReturnType<typeof getFFmpegFallback>["extractAudioAsWav"]>[2],
  );
}
