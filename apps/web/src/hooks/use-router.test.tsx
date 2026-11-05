import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { generateShareableLink, useRouter } from "./use-router";

afterEach(() => {
  vi.restoreAllMocks();
  window.location.hash = "";
});

describe("useRouter", () => {
  it.each(["", "#/welcome", "#/templates", "#/recent", "#/not-a-route"])("uses the editor for %s", (hash) => {
    window.location.hash = hash;
    const { result } = renderHook(() => useRouter());
    expect(result.current.route).toBe("editor");
  });

  it.each([
    "#/share", "#/share/", "#/share/video-1", "#/share/nested/path",
    "#/share/video-1?fps=120&width=10&height=10", "#share/video-1",
  ])("redirects %s to the editor without share parameters", (hash) => {
    window.location.hash = hash;
    const replace = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(() => useRouter());
    expect(result.current.route).toBe("editor");
    expect(result.current.params).toEqual({});
    expect(window.location.hash).toBe("#/editor");
    expect(replace).toHaveBeenCalledWith(window.history.state, "", "#/editor");
  });

  it("redirects share links visited after the app has loaded", () => {
    window.location.hash = "#/editor";
    const { result } = renderHook(() => useRouter());
    act(() => {
      window.location.hash = "#/share/video-1?fps=120";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(result.current.route).toBe("editor");
    expect(result.current.params).toEqual({});
    expect(window.location.hash).toBe("#/editor");
  });

  it("normalizes programmatic share navigation and generated links", () => {
    const { result } = renderHook(() => useRouter());
    act(() => result.current.navigate("share", { shareId: "video-1" }));
    expect(window.location.hash).toBe("#/editor");
    expect(generateShareableLink("share", { shareId: "video-1" })).toBe(
      `${window.location.origin}${window.location.pathname}#/editor`,
    );
  });
  it("opens stale Motion Creator links in the video editor", () => {
    window.location.hash = "#/motion?compositionId=comp-1";

    const { result } = renderHook(() => useRouter());

    expect(result.current.route).toBe("editor");
  });

  it("normalizes Motion Creator navigation to the video editor", () => {
    const { result } = renderHook(() => useRouter());

    act(() => result.current.navigate("motion", { compositionId: "comp-1" }));

    expect(window.location.hash).toBe("#/editor");
  });
});
