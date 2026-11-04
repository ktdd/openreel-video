import { describe, it, expect } from "vitest";
import { getTabIdsForClipType, getTabsForClipType, TAB_DEFS } from "./clip-tabs.config";

describe("clip-tabs.config", () => {
  it("video has six manual media tabs in workflow order", () => {
    expect(getTabIdsForClipType("video")).toEqual([
      "transform", "color", "effects", "audio", "speed", "animate",
    ]);
  });

  it("image has speed but no audio", () => {
    expect(getTabIdsForClipType("image")).toEqual([
      "transform", "color", "effects", "speed", "animate",
    ]);
  });

  it("audio shows only manual audio controls", () => {
    expect(getTabIdsForClipType("audio")).toEqual(["audio"]);
  });

  it("text/shape/svg share transform/style/effects/animate", () => {
    for (const t of ["text", "shape", "svg"] as const) {
      expect(getTabIdsForClipType(t)).toEqual(["transform", "style", "effects", "animate"]);
    }
  });

  it("sticker has transform/effects/animate (no style/ai)", () => {
    expect(getTabIdsForClipType("sticker")).toEqual(["transform", "effects", "animate"]);
  });

  it("null clip type yields no tabs", () => {
    expect(getTabIdsForClipType(null)).toEqual([]);
    expect(getTabsForClipType(null)).toEqual([]);
  });

  it("getTabsForClipType returns defs with labels and icons", () => {
    const defs = getTabsForClipType("video");
    expect(defs[0]).toMatchObject({ id: "transform", label: "Transform" });
    expect(typeof defs[0].icon).toBe("object");
    expect(Object.keys(TAB_DEFS)).toHaveLength(7);
    expect(Object.keys(TAB_DEFS)).not.toContain("ai");
  });
});
