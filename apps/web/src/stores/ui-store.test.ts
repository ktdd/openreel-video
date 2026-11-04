import "../test/install-local-storage-mock";
import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./ui-store";

describe("ui-store inspectorActiveTab", () => {
  beforeEach(() => useUIStore.setState({ inspectorActiveTab: "transform" }));
  it("defaults to transform", () => {
    expect(useUIStore.getState().inspectorActiveTab).toBe("transform");
  });
  it("setInspectorActiveTab updates the value", () => {
    useUIStore.getState().setInspectorActiveTab("color");
    expect(useUIStore.getState().inspectorActiveTab).toBe("color");
  });
  it("has no desktop navigation state or action", () => {
    expect(useUIStore.getState()).not.toHaveProperty("desktopPage");
    expect(useUIStore.getState()).not.toHaveProperty("setDesktopPage");
  });
});
