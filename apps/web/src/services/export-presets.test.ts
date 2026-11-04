import "../test/install-local-storage-mock";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlatformExportPreset } from "./export-presets";

afterEach(() => { localStorage.clear(); vi.resetModules(); });

describe("export presets survive product-template retirement", () => {
  it("retains built-ins and loads, edits, and saves existing custom encoding presets", async () => {
    const custom: PlatformExportPreset = {
      id: "custom-saved", name: "My export", description: "Saved encoding settings", platform: "Custom", category: "custom",
      settings: { format: "mp4", codec: "h264", width: 1920, height: 1080, frameRate: 24,
        bitrate: 10000, bitrateMode: "vbr", quality: 85, keyframeInterval: 48,
        audioSettings: { format: "aac", sampleRate: 48000, channels: 2, bitDepth: 16, bitrate: 192 } },
    };
    localStorage.setItem("openreel-custom-export-presets", JSON.stringify([custom]));
    const { exportPresetsManager: manager, ALL_EXPORT_PRESETS } = await import("./export-presets");
    expect(manager.getPreset("custom-saved")).toEqual(custom);
    expect(manager.getPreset("youtube-4k")?.settings).toMatchObject({
      width: 3840, height: 2160, frameRate: 30, format: "mp4", codec: "h264", bitrate: 50000,
    });
    expect(manager.getPreset("archive-1080p-prores")?.settings).toMatchObject({
      format: "mov", codec: "prores", width: 1920, height: 1080,
    });
    expect(manager.getAllPresets()).toHaveLength(ALL_EXPORT_PRESETS.length + 1);
    expect(manager.updateCustomPreset("custom-saved", { name: "Renamed export" })).toBe(true);
    expect(JSON.parse(localStorage.getItem("openreel-custom-export-presets")!)[0]).toEqual({ ...custom, name: "Renamed export" });
    expect(manager.deleteCustomPreset("custom-saved")).toBe(true);
    expect(manager.getAllPresets()).toEqual(ALL_EXPORT_PRESETS);
  });
});
