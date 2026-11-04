import "../../test/install-local-storage-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Action } from "@openreel/core";
import { createPortableEdit, materializePortableEdit, parsePortableEdit } from "@openreel/core/editing/portable-project";
import { useProjectStore } from "../project-store";

const current = () => useProjectStore.getState();
const timeline = () => structuredClone(current().project.timeline);
async function dispatch(type: string, params: Record<string, unknown>) {
  const result = await current().executeAction({ type, params, id: crypto.randomUUID(), timestamp: Date.now() } as Action);
  expect(result.success, JSON.stringify(result.error)).toBe(true);
}

beforeEach(async () => {
  current().createNewProject("Ordinary layered video", { width: 640, height: 360, frameRate: 24 });
  const project = current().project;
  useProjectStore.setState({ project: { ...project, mediaLibrary: { items: [{
    id: "source", name: "source.mp4", type: "video", fileHandle: null, blob: new Blob(["local-media"]),
    thumbnailUrl: null, waveformData: null,
    metadata: { duration: 6, width: 640, height: 360, frameRate: 24, sampleRate: 48000, channels: 2, codec: "avc", fileSize: 11 },
  }] } } });
  for (const [trackId, clipId] of [["base", "base-clip"], ["overlay", "overlay-clip"]]) {
    await dispatch("track/add", { trackType: "video", trackId });
    await dispatch("clip/add", { trackId, mediaId: "source", clipId, startTime: 0, duration: 6 });
  }
  current().actionHistory.clear();
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("ordinary multi-track editing without camera tooling", () => {
  it("preserves trim, transforms, keyframes and track states through grouped undo/redo", async () => {
    const before = timeline();
    current().beginHistoryGroup("Layered edit");
    await dispatch("clip/trim", { clipId: "base-clip", inPoint: 1, outPoint: 5 });
    await dispatch("transform/update", { clipId: "overlay-clip", transform: { position: { x: 0.75, y: 0.25 }, scale: { x: 0.5, y: 0.5 }, rotation: 15, opacity: 0.8 } });
    await dispatch("keyframe/add", { clipId: "overlay-clip", property: "opacity", time: 1, value: 0.4, easing: "linear" });
    expect((await current().hideTrack("overlay", true)).success).toBe(true);
    expect((await current().muteTrack("overlay", true)).success).toBe(true);
    expect((await current().soloTrack("base", true)).success).toBe(true);
    current().endHistoryGroup();
    const after = timeline();
    expect(after.tracks[0].clips[0]).toMatchObject({ inPoint: 1, outPoint: 5, duration: 4, mediaId: "source" });
    expect(after.tracks[1]).toMatchObject({ hidden: true, muted: true, solo: false });
    expect(after.tracks[1].clips[0]).toMatchObject({ transform: { rotation: 15, opacity: 0.8 }, keyframes: [expect.objectContaining({ time: 1, value: 0.4 })] });
    expect(current().actionHistory.getDisplayHistory()).toHaveLength(1);
    expect((await current().undo()).success).toBe(true);
    expect(timeline()).toEqual(before);
    expect((await current().redo()).success).toBe(true);
    expect(timeline()).toEqual(after);
    expect(current().project.mediaLibrary.items[0].blob).toBeInstanceOf(Blob);
  });

  it("roundtrips current-format layered edits, generic track groups and local media without workers or requests", async () => {
    const worker = vi.fn(() => { throw new Error("Unexpected worker"); });
    const request = vi.fn(() => { throw new Error("Unexpected network request"); });
    vi.stubGlobal("Worker", worker);
    vi.stubGlobal("fetch", request);
    expect(current().groupTracks("base", "overlay")).toBe(true);
    await dispatch("transform/update", { clipId: "overlay-clip", transform: { rotation: 30 } });
    await dispatch("keyframe/add", { clipId: "overlay-clip", property: "opacity", time: 2, value: 0.5, easing: "linear" });
    await current().hideTrack("overlay", true);
    await current().muteTrack("overlay", true);
    await current().soloTrack("base", true);
    await current().lockTrack("overlay", true);
    const project = current().getFullProject();
    const doc = parsePortableEdit(JSON.stringify(createPortableEdit(project)));
    const restored = materializePortableEdit(doc, project);
    expect(restored.missing).toEqual([]);
    expect(restored.project.timeline).toEqual(project.timeline);
    expect(restored.project.mediaLibrary.items[0].blob).toBe(project.mediaLibrary.items[0].blob);
    current().loadProject(restored.project);
    expect(current().project.timeline).toEqual(project.timeline);
    expect(current().project.timeline.tracks.map((track) => track.groupId)).toEqual([expect.any(String), project.timeline.tracks[0].groupId]);
    expect(worker).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});
