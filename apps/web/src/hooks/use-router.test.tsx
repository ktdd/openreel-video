import { afterEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRouter } from "./use-router";

afterEach(() => {
  window.location.hash = "";
});

describe("useRouter", () => {
  it.each(["", "#/welcome", "#/templates", "#/recent", "#/not-a-route"])("uses the editor for %s", (hash) => {
    window.location.hash = hash;
    const { result } = renderHook(() => useRouter());
    expect(result.current.route).toBe("editor");
  });

  it("keeps shared-video links independent", () => {
    window.location.hash = "#/share/video-1";
    const { result } = renderHook(() => useRouter());
    expect(result.current.route).toBe("share");
    expect(result.current.params.shareId).toBe("video-1");
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
