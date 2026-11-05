import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VidstabEngine } from "./vidstab-engine";

const { worker, createFFmpeg, toBlobURL } = vi.hoisted(() => ({
  worker: { load: vi.fn(), terminate: vi.fn() },
  createFFmpeg: vi.fn(),
  toBlobURL: vi.fn(),
}));
vi.mock("@ffmpeg/ffmpeg", () => ({ FFmpeg: createFFmpeg }));
vi.mock("@ffmpeg/util", () => ({ toBlobURL }));

let engine: VidstabEngine;

beforeEach(() => {
  vi.resetAllMocks();
  createFFmpeg.mockImplementation(function () { return worker; });
  worker.load.mockResolvedValue(undefined);
  toBlobURL.mockImplementation(async (url: string) => `blob:${url}`);
  vi.stubGlobal("crossOriginIsolated", false);
  engine = new VidstabEngine();
});
afterEach(() => {
  engine.dispose();
  vi.unstubAllGlobals();
});

describe("hosted vidstab core loading", () => {
  it.each([
    [true, "vidstab-mt"],
    [false, "vidstab-st"],
    [undefined, "vidstab-st"],
  ] as const)("selects %s isolation's %s assets", async (isolated, directory) => {
    vi.stubGlobal("crossOriginIsolated", isolated);
    const progress = vi.fn();
    const base = `https://ssh.karri.me/vid-assets/${directory}`;
    await engine.load(progress);

    const expectedDownloads = [
      [`${base}/ffmpeg-core.js`, "text/javascript"],
      [`${base}/ffmpeg-core.wasm`, "application/wasm"],
    ];
    if (isolated) expectedDownloads.push([`${base}/ffmpeg-core.worker.js`, "text/javascript"]);
    expect(toBlobURL.mock.calls).toEqual(expectedDownloads);
    expect(worker.load).toHaveBeenCalledWith({
      coreURL: `blob:${base}/ffmpeg-core.js`,
      wasmURL: `blob:${base}/ffmpeg-core.wasm`,
      ...(isolated ? { workerURL: `blob:${base}/ffmpeg-core.worker.js` } : {}),
    });
    expect(progress.mock.calls).toEqual([
      [{ stage: "downloading", progress: 0 }],
      [{ stage: "downloading", progress: 0.9 }],
      [{ stage: "downloading", progress: 1 }],
    ]);
    expect(engine.isLoaded()).toBe(true);
  });

  it("loads only on demand and shares initialization until the core is ready", async () => {
    let finishLoad!: () => void;
    worker.load.mockReturnValue(new Promise<void>((resolve) => { finishLoad = resolve; }));
    expect(toBlobURL).not.toHaveBeenCalled();
    expect(createFFmpeg).not.toHaveBeenCalled();

    const first = engine.load();
    const second = engine.load();
    await vi.waitFor(() => expect(worker.load).toHaveBeenCalledOnce());
    expect(engine.isLoaded()).toBe(false);
    expect(createFFmpeg).toHaveBeenCalledOnce();
    expect(toBlobURL).toHaveBeenCalledTimes(2);

    finishLoad();
    await Promise.all([first, second]);
    await engine.load();
    expect(engine.isLoaded()).toBe(true);
    expect(worker.load).toHaveBeenCalledOnce();
    expect(toBlobURL).toHaveBeenCalledTimes(2);
  });

  it("reports an asset download failure without trying another host and permits retry", async () => {
    toBlobURL.mockRejectedValueOnce(new Error("Network unavailable"));
    await expect(engine.load()).rejects.toThrow("Failed to load FFmpeg vidstab core: Network unavailable");
    expect(engine.isLoaded()).toBe(false);
    expect(worker.load).not.toHaveBeenCalled();
    expect(toBlobURL).toHaveBeenCalledTimes(2);

    await engine.load();
    expect(engine.isLoaded()).toBe(true);
    expect(toBlobURL).toHaveBeenCalledTimes(4);
    expect(toBlobURL.mock.calls.every(([url]) =>
      String(url).startsWith("https://ssh.karri.me/vid-assets/vidstab-st/"),
    )).toBe(true);
  });

  it("reports core initialization failure and permits retry", async () => {
    worker.load.mockRejectedValueOnce(new Error("Invalid WASM"));
    await expect(engine.load()).rejects.toThrow("Failed to load FFmpeg vidstab core: Invalid WASM");
    expect(engine.isLoaded()).toBe(false);

    await engine.load();
    expect(engine.isLoaded()).toBe(true);
    expect(worker.load).toHaveBeenCalledTimes(2);
  });
});
