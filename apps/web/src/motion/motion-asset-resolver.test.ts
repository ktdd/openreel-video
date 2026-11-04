import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaItem, MotionAsset } from "@openreel/core";
import { clearWebMotionAssetBitmapCache, createWebMotionAssetResolver } from "./motion-asset-resolver";

describe("web motion asset resolver", () => {
  beforeEach(() => clearWebMotionAssetBitmapCache());
  afterEach(() => { vi.unstubAllGlobals(); clearWebMotionAssetBitmapCache(); });

  it("resolves image media blobs through a shared bitmap cache", async () => {
    const blob = new Blob(["image"], { type: "image/png" });
    const bitmap = { width: 8, height: 8, close: vi.fn() } as unknown as ImageBitmap;
    const createBitmap = vi.fn().mockResolvedValue(bitmap);
    vi.stubGlobal("createImageBitmap", createBitmap);
    const resolver = createWebMotionAssetResolver([{ id: "media-1", type: "image", blob } as unknown as MediaItem]);
    const asset: MotionAsset = { id: "asset-1", type: "image", name: "Logo", mediaId: "media-1" };
    await expect(resolver.resolveImageAsset(asset)).resolves.toBe(bitmap);
    await expect(resolver.resolveImageAsset(asset)).resolves.toBe(bitmap);
    expect(createBitmap).toHaveBeenCalledOnce();
    expect(createBitmap).toHaveBeenCalledWith(blob);
  });

  it("ignores non-image assets without creating a bitmap", async () => {
    const createBitmap = vi.fn();
    vi.stubGlobal("createImageBitmap", createBitmap);
    await expect(createWebMotionAssetResolver([]).resolveImageAsset({ id: "vector", type: "svg", name: "Vector" })).resolves.toBeNull();
    expect(createBitmap).not.toHaveBeenCalled();
  });

  it.each(["https://example.invalid/scene.glb", "blob:local-model", "data:model/gltf+json,{}"]) (
    "passes the 3D model URL to the browser renderer: %s", async (url) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const resolver = createWebMotionAssetResolver([]);
      await expect(resolver.resolveModelUrl?.(url)).resolves.toBe(url);
      expect(resolver.renderScene3D).toBeUndefined();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
});
