import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoReframeEngine, DEFAULT_REFRAME_SETTINGS, PLATFORM_PRESETS } from "./auto-reframe-engine";

afterEach(() => { vi.unstubAllGlobals(); });
describe("heuristic reframing", () => {
  it("uses local pixels, retains platform dimensions and does not download models", async () => {
    const fetch = vi.fn(() => { throw new Error("No model downloads"); });
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("Worker", class { constructor() { throw new Error("No inference workers"); } });
    const drawImage = vi.fn();
    const pixels = vi.fn((_x: number, _y: number, width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }));
    vi.stubGlobal("OffscreenCanvas", class {
      constructor(public width: number, public height: number) {}
      getContext() { return { drawImage, getImageData: pixels }; }
    });
    const engine = new AutoReframeEngine();
    const frame = { width: 160, height: 90 } as ImageBitmap;
    const progress = vi.fn();
    await engine.initialize(progress);
    const result = await engine.analyzeClip([frame, frame], 30, { ...DEFAULT_REFRAME_SETTINGS, followSubject: false });
    expect(engine.isInitialized()).toBe(true);
    expect(result.success).toBe(true);
    expect(result.outputWidth).toBe(1080);
    expect(result.outputHeight).toBe(1920);
    expect(result.keyframes.map((keyframe) => keyframe.time)).toEqual([0, 1 / 30]);
    expect(result.keyframes.every((keyframe) => keyframe.cropWidth > 0 && keyframe.cropWidth <= 160 && keyframe.cropHeight <= 90)).toBe(true);
    expect(PLATFORM_PRESETS.tiktok).toMatchObject({ width: 1080, height: 1920 });
    expect(progress).toHaveBeenLastCalledWith(100, "Auto-reframe engine ready");
    const calls = pixels.mock.calls.length;
    await engine.analyzeClip([frame], 30, DEFAULT_REFRAME_SETTINGS);
    expect(pixels.mock.calls.length).toBe(calls + 1);
    expect(fetch).not.toHaveBeenCalled();
    engine.dispose();
    expect(engine.isInitialized()).toBe(false);
  });
});
