import "../../test/install-local-storage-mock";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetsPanel } from "./AssetsPanel";
import { EditorActionRail } from "./EditorActionRail";
import { useProjectStore } from "../../stores/project-store";
import { createEmptyProject } from "../../stores/project/project-helpers";

const capture = { getDisplayMedia: vi.fn(), getUserMedia: vi.fn() };
const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: capture });
  localStorage.clear();
  useProjectStore.setState({ project: createEmptyProject("Manual edit") });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.useRealTimers();
  if (originalMediaDevices) Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  else Reflect.deleteProperty(navigator, "mediaDevices");
});

describe("retired product surfaces", () => {
  it("keeps import and Recipes but exposes no template browser or recorder", () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const view = render(<AssetsPanel />);
    expect(view.getByRole("button", { name: "Import media" })).toBeInTheDocument();
    expect(view.getByRole("button", { name: "Recipes" })).toBeInTheDocument();
    expect(view.queryByRole("button", { name: /project templates/i })).toBeNull();
    expect(view.queryByRole("button", { name: /record/i })).toBeNull();
    expect(capture.getDisplayMedia).not.toHaveBeenCalled();
    expect(capture.getUserMedia).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("has no home, recorder, or tour actions and does not auto-start tours", () => {
    vi.useFakeTimers();
    const fetch = vi.spyOn(globalThis, "fetch");
    const getItem = vi.spyOn(localStorage, "getItem");
    const view = render(<EditorActionRail />);
    fireEvent.click(view.getByRole("button", { name: "More editor actions" }));
    expect(view.queryByText("Screen recorder")).toBeNull();
    expect(view.queryByText("Editor tour")).toBeNull();
    expect(view.queryByText("Animation & effects tour")).toBeNull();
    expect(view.queryByRole("button", { name: "Back to home" })).toBeNull();
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(getItem).not.toHaveBeenCalledWith("openreel-onboarding-complete");
    expect(getItem).not.toHaveBeenCalledWith("openreel-mograph-tour-complete");
    expect(fetch).not.toHaveBeenCalled();
    expect(capture.getDisplayMedia).not.toHaveBeenCalled();
    expect(capture.getUserMedia).not.toHaveBeenCalled();
  });
});
