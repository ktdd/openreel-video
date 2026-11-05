import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DecodeRequest, WorkerRequest, WorkerResponse } from "./decode-worker-types";

const media = vi.hoisted(() => ({
  formats: ["test-format"],
  inputs: [] as Array<{ dispose: ReturnType<typeof vi.fn> }>,
  getPrimaryVideoTrack: vi.fn(),
  getCanvas: vi.fn(),
  Input: vi.fn(),
  BlobSource: vi.fn(),
  CanvasSink: vi.fn(),
}));
vi.mock("mediabunny", () => ({
  ALL_FORMATS: media.formats,
  Input: media.Input,
  BlobSource: media.BlobSource,
  CanvasSink: media.CanvasSink,
}));

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: ReturnType<typeof vi.fn<[WorkerResponse, Transferable[]?], void>>;
}

let scope: WorkerScope;
let bitmap: ImageBitmap;
let canvas: OffscreenCanvas;
let createBitmap: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;

function send(request: WorkerRequest): void {
  expect(scope.onmessage).toBeTypeOf("function");
  scope.onmessage!({ data: request } as MessageEvent<WorkerRequest>);
}

function request(overrides: Partial<DecodeRequest> = {}): DecodeRequest {
  return {
    type: "decode", requestId: "request-1", clipId: "clip-1", blob: new Blob(["video"]),
    time: 1.5, width: 640, height: 360, ...overrides,
  };
}

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  media.inputs.length = 0;
  media.Input.mockImplementation(function () {
    const input = { getPrimaryVideoTrack: media.getPrimaryVideoTrack, dispose: vi.fn() };
    media.inputs.push(input);
    return input;
  });
  media.BlobSource.mockImplementation(function (blob: Blob) { return { blob }; });
  media.CanvasSink.mockImplementation(function () { return { getCanvas: media.getCanvas }; });
  media.getPrimaryVideoTrack.mockResolvedValue({ id: "video-track" });
  canvas = {} as OffscreenCanvas;
  bitmap = { close: vi.fn() } as unknown as ImageBitmap;
  media.getCanvas.mockResolvedValue({ canvas });
  createBitmap = vi.fn().mockResolvedValue(bitmap);
  fetchMock = vi.fn().mockImplementation(() => { throw new Error("Unexpected worker network request"); });
  scope = { onmessage: null, postMessage: vi.fn() };
  vi.stubGlobal("self", scope);
  vi.stubGlobal("createImageBitmap", createBitmap);
  vi.stubGlobal("fetch", fetchMock);
  await import("./decode-worker");
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("bundled MediaBunny decode worker", () => {
  it("announces availability from the imported module without fetching a CDN", () => {
    send({ type: "init" });
    expect(scope.postMessage).toHaveBeenCalledWith({
      type: "ready", workerId: expect.any(Number), mediabunnyAvailable: true,
    });
    expect(media.Input).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the supplied Blob to MediaBunny and transfers bitmap ownership", async () => {
    const decode = request();
    send(decode);
    await vi.waitFor(() => expect(scope.postMessage).toHaveBeenCalledOnce());
    expect(media.BlobSource).toHaveBeenCalledWith(decode.blob);
    expect(media.Input).toHaveBeenCalledWith({ source: { blob: decode.blob }, formats: media.formats });
    expect(media.CanvasSink).toHaveBeenCalledWith({ id: "video-track" }, {
      width: 640, height: 360, fit: "contain",
    });
    expect(media.getCanvas).toHaveBeenCalledWith(1.5);
    expect(createBitmap).toHaveBeenCalledWith(canvas);
    expect(scope.postMessage).toHaveBeenCalledWith({
      type: "decoded", requestId: "request-1", clipId: "clip-1", time: 1.5, bitmap,
    }, [bitmap]);
    expect(bitmap.close).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reuses resources for a clip at the same dimensions", async () => {
    send(request());
    send(request({ requestId: "request-2", time: 2 }));
    await vi.waitFor(() => expect(scope.postMessage).toHaveBeenCalledTimes(2));
    expect(media.Input).toHaveBeenCalledOnce();
    expect(media.CanvasSink).toHaveBeenCalledOnce();
    expect(media.getCanvas.mock.calls).toEqual([[1.5], [2]]);
    expect(media.inputs[0].dispose).not.toHaveBeenCalled();
  });

  it("keeps decode and bitmap copy serialized before replacing a resized clip's resources", async () => {
    let finishCopy!: (value: ImageBitmap) => void;
    createBitmap.mockReturnValueOnce(new Promise<ImageBitmap>((resolve) => { finishCopy = resolve; }));
    send(request());
    send(request({ requestId: "request-2", width: 320, height: 180 }));
    await vi.waitFor(() => expect(createBitmap).toHaveBeenCalledOnce());
    expect(media.getCanvas).toHaveBeenCalledOnce();
    expect(media.Input).toHaveBeenCalledOnce();
    expect(media.inputs[0].dispose).not.toHaveBeenCalled();
    expect(scope.postMessage).not.toHaveBeenCalled();

    finishCopy(bitmap);
    await vi.waitFor(() => expect(scope.postMessage).toHaveBeenCalledTimes(2));
    expect(media.inputs[0].dispose).toHaveBeenCalledOnce();
    expect(media.Input).toHaveBeenCalledTimes(2);
    expect(media.CanvasSink).toHaveBeenLastCalledWith({ id: "video-track" }, {
      width: 320, height: 180, fit: "contain",
    });
  });

  it.each(["missing track", "track lookup failure", "sink setup failure"])(
    "disposes an input after %s and allows another request", async (failure) => {
      if (failure === "missing track") media.getPrimaryVideoTrack.mockResolvedValueOnce(null);
      if (failure === "track lookup failure") media.getPrimaryVideoTrack.mockRejectedValueOnce(new Error("Track failed"));
      if (failure === "sink setup failure") media.CanvasSink.mockImplementationOnce(function () { throw new Error("Sink failed"); });
      send(request());
      await vi.waitFor(() => expect(scope.postMessage).toHaveBeenCalledOnce());
      expect(media.inputs[0].dispose).toHaveBeenCalledOnce();
      expect(scope.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: "decoded", bitmap: null, error: expect.any(String),
      }), []);

      send(request({ requestId: "retry" }));
      await vi.waitFor(() => expect(scope.postMessage).toHaveBeenCalledTimes(2));
      expect(media.Input).toHaveBeenCalledTimes(2);
      expect(scope.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
        requestId: "retry", bitmap,
      }), [bitmap]);
    },
  );

  it.each(["missing frame", "decode failure", "bitmap failure"])(
    "returns an error after %s without blocking the next decode", async (failure) => {
      if (failure === "missing frame") media.getCanvas.mockResolvedValueOnce(null);
      if (failure === "decode failure") media.getCanvas.mockRejectedValueOnce(new Error("Decode failed"));
      if (failure === "bitmap failure") createBitmap.mockRejectedValueOnce(new Error("Bitmap failed"));
      send(request());
      send(request({ requestId: "request-2" }));
      await vi.waitFor(() => expect(scope.postMessage).toHaveBeenCalledTimes(2));
      expect(scope.postMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
        requestId: "request-1", bitmap: null, error: expect.any(String),
      }), []);
      expect(scope.postMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
        requestId: "request-2", bitmap,
      }), [bitmap]);
    },
  );

  it("closes a bitmap that could not be transferred and reports the failure", async () => {
    scope.postMessage.mockImplementationOnce(() => { throw new Error("Transfer failed"); });
    send(request());
    await vi.waitFor(() => expect(scope.postMessage).toHaveBeenCalledTimes(2));
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(scope.postMessage).toHaveBeenLastCalledWith({
      type: "decoded", requestId: "request-1", clipId: "clip-1", time: 1.5,
      bitmap: null, error: "Transfer failed",
    });
  });
});
