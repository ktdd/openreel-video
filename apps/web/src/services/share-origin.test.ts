import { describe, it, expect } from "vitest";
import { shareBaseOrigin } from "./share-origin";
import { generateShareableLink } from "../hooks/use-router";
import { getSharePageUrl } from "./share-service";

describe("shareBaseOrigin", () => {
  it("uses window.location origin+pathname on web", () => {
    const expected = `${window.location.origin}${window.location.pathname}`;
    expect(shareBaseOrigin()).toBe(expected);
    expect(getSharePageUrl("x")).toBe(`${expected}#/share/x`);
  });

  it("redirects disabled Motion Creator links to the video editor", () => {
    const expected = `${window.location.origin}${window.location.pathname}`;
    expect(generateShareableLink("motion", { compositionId: "comp-1" })).toBe(
      `${expected}#/editor`,
    );
  });
});
