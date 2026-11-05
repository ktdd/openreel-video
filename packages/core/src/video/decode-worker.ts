import { Input, ALL_FORMATS, BlobSource, CanvasSink } from "mediabunny";
import type {
  DecodeRequest,
  DecodeResponse,
  WorkerRequest,
  WorkerResponse,
} from "./decode-worker-types";

interface CachedResource {
  input: Input;
  sink: CanvasSink;
  width: number;
  height: number;
}

const resourceCache = new Map<string, CachedResource>();
const workerId = Math.floor(Math.random() * 10000);

async function getOrCreateResources(
  clipId: string,
  blob: Blob,
  width: number,
  height: number,
): Promise<CachedResource> {
  const cached = resourceCache.get(clipId);
  if (cached) {
    if (cached.width === width && cached.height === height) return cached;
    cached.input.dispose();
    resourceCache.delete(clipId);
  }

  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  try {
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error("No video track available");

    const sink = new CanvasSink(videoTrack, { width, height, fit: "contain" });
    const resource = { input, sink, width, height };
    resourceCache.set(clipId, resource);
    return resource;
  } catch (error) {
    input.dispose();
    throw error;
  }
}

async function decodeFrame(request: DecodeRequest): Promise<DecodeResponse> {
  const { requestId, clipId, blob, time, width, height } = request;
  const response: DecodeResponse = { type: "decoded", requestId, clipId, bitmap: null, time };

  try {
    const resources = await getOrCreateResources(clipId, blob, width, height);
    const frameResult = await resources.sink.getCanvas(time);
    if (!frameResult) return { ...response, error: "No frame at requested time" };

    return { ...response, bitmap: await createImageBitmap(frameResult.canvas) };
  } catch (error) {
    return { ...response, error: error instanceof Error ? error.message : "Unknown decode error" };
  }
}

// This module is loaded only as a bundled worker entry, never by the main thread.
const workerSelf = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

// Keep a cached sink's decoding and canvas-to-bitmap copy together. The pool can
// queue multiple requests per worker, including different sizes for one clip.
let decodeQueue = Promise.resolve();
workerSelf.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  if (request.type === "init") {
    workerSelf.postMessage({ type: "ready", workerId, mediabunnyAvailable: true });
    return;
  }

  decodeQueue = decodeQueue.then(async () => {
    const response = await decodeFrame(request);
    try {
      workerSelf.postMessage(response, response.bitmap ? [response.bitmap] : []);
    } catch (error) {
      response.bitmap?.close();
      workerSelf.postMessage({
        ...response,
        bitmap: null,
        error: error instanceof Error ? error.message : "Failed to transfer decoded frame",
      });
    }
  });
};
