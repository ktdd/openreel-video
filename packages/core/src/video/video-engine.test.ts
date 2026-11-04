import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "../types/project";
import type { MotionRendererAssetResolver } from "../motion/motion-renderer";

beforeEach(() => { vi.stubGlobal("self", { onmessage: null, postMessage: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }); });
afterEach(() => { vi.unstubAllGlobals(); });
async function resolver(project: Project): Promise<MotionRendererAssetResolver> {
  const { VideoEngine } = await import("./video-engine");
  const engine = new VideoEngine();
  return (engine as unknown as { createMotionAssetResolver(project: Project): MotionRendererAssetResolver }).createMotionAssetResolver(project);
}
describe("VideoEngine browser motion asset resolver", () => {
  it("uses the normal scene renderer without installing an IPC override or fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const assets = await resolver({ mediaLibrary: { items: [] } } as unknown as Project);
    expect(assets.renderScene3D).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps project image resolution and the shared bitmap cache", async () => {
    const blob = new Blob(["image"], { type: "image/png" });
    const bitmap = { width: 8, height: 8, close: vi.fn() } as unknown as ImageBitmap;
    const createBitmap = vi.fn().mockResolvedValue(bitmap);
    vi.stubGlobal("createImageBitmap", createBitmap);
    const assets = await resolver({ mediaLibrary: { items: [{ id: "image", type: "image", blob }] } } as unknown as Project);
    const asset = { id: "motion-image", type: "image" as const, name: "Image", mediaId: "image" };
    await expect(assets.resolveImageAsset(asset)).resolves.toBe(bitmap);
    await expect(assets.resolveImageAsset(asset)).resolves.toBe(bitmap);
    expect(createBitmap).toHaveBeenCalledOnce();
    expect(createBitmap).toHaveBeenCalledWith(blob);
    expect(bitmap.close).not.toHaveBeenCalled();
  });
});
