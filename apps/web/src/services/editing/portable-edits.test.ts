import "../../test/install-local-storage-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPortableEdit, type EditPreset } from "@openreel/core/editing/portable-project";
import { useProjectStore } from "../../stores/project-store";
import { useEngineStore } from "../../stores/engine-store";
import { EditingSession } from "./editing-session";
import { applySharedPreset, importPortableEdit, relinkSharedMedia, runLocalEdit } from "./portable-edits";
import { getMediaBridge } from "../../bridges/media-bridge";
import { runExclusive } from "./mutation-queue";

const preset: EditPreset = {
  format: "openreel-preset", version: 1, name: "Shared look",
  effects: [{ id: "shared-effect", type: "brightness", enabled: false, params: { value: 0.1 } }],
  transition: { type: "crossfade", duration: 0.5, params: {} },
};
const document = () => createPortableEdit(useProjectStore.getState().getFullProject());

beforeEach(async () => {
  useProjectStore.getState().createNewProject("Manual sharing");
  const project = useProjectStore.getState().project;
  useProjectStore.setState({ project: { ...project, mediaLibrary: { items: [{
    id: "media", name: "source.mp4", type: "video", blob: new Blob(["fixture"]), fileHandle: null,
    thumbnailUrl: null, waveformData: null,
    metadata: { duration: 6, width: 640, height: 360, frameRate: 30, codec: "avc", sampleRate: 48000, channels: 2, fileSize: 7 },
  }] } } });
  for (const action of [
    { type: "track/add", params: { trackType: "video", trackId: "video-track" } },
    { type: "clip/add", params: { trackId: "video-track", mediaId: "media", clipId: "first", startTime: 0, inPoint: 0, outPoint: 3, duration: 3 } },
    { type: "clip/add", params: { trackId: "video-track", mediaId: "media", clipId: "next", startTime: 3, inPoint: 3, outPoint: 6, duration: 3 } },
  ]) {
    expect((await useProjectStore.getState().executeAction({ ...action, id: crypto.randomUUID(), timestamp: Date.now() })).success).toBe(true);
  }
  useProjectStore.getState().actionHistory.clear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe("local portable editing", () => {
  it("applies effects and transitions with fresh IDs as exactly one undo/redo step", async () => {
    const before = document();
    await applySharedPreset("first", preset);
    const after = document();
    const track = useProjectStore.getState().project.timeline.tracks[0];
    expect(track.clips[0].effects[0]).toMatchObject({ enabled: false, type: "brightness" });
    expect(track.clips[0].effects[0].id).not.toBe("shared-effect");
    expect(track.transitions).toHaveLength(1);
    expect(useProjectStore.getState().actionHistory.getUndoStackSize()).toBe(1);
    await useProjectStore.getState().undo();
    expect(document()).toEqual(before);
    await useProjectStore.getState().redo();
    expect(document()).toEqual(after);
  });

  it("rolls back earlier preset effects when its transition fails and preserves redo", async () => {
    await applySharedPreset("first", { ...preset, transition: undefined });
    await useProjectStore.getState().undo();
    const before = document();
    await expect(applySharedPreset("next", preset)).rejects.toThrow(/adjacent/);
    expect(document()).toEqual(before);
    expect(useProjectStore.getState().canUndo()).toBe(false);
    expect(useProjectStore.getState().canRedo()).toBe(true);
  });

  it("imports portable edits as one step without resetting other UI sessions", async () => {
    const source = document();
    const changed = { ...source, project: { ...source.project, name: "Imported name" } };
    const blob = useProjectStore.getState().project.mediaLibrary.items[0].blob;
    await importPortableEdit(changed);
    expect(useProjectStore.getState().project.name).toBe("Imported name");
    expect(useProjectStore.getState().project.mediaLibrary.items[0].blob).toBe(blob);
    expect(useProjectStore.getState().actionHistory.getUndoStackSize()).toBe(1);
    await useProjectStore.getState().undo();
    expect(document()).toEqual(source);
  });

  it("rejects stale drafts and preserves the user's intervening edit", async () => {
    const session = new EditingSession(); const transaction = session.beginTransaction();
    await session.applyAction({ type: "track/add", id: "draft", timestamp: Date.now(), params: { trackType: "image" } });
    await useProjectStore.getState().renameProject("User edit");
    await expect(session.commitTransaction(transaction, "Prepared edit")).rejects.toThrow(/project changed/);
    expect(useProjectStore.getState().project.name).toBe("User edit");
    expect(useProjectStore.getState().project.timeline.tracks).toHaveLength(1);
  });

  it("detects concurrent file-handle changes even without a timestamp change", async () => {
    const session = new EditingSession();
    const transaction = session.beginTransaction();
    await session.applyAction({ type: "track/add", id: "draft", timestamp: Date.now(), params: { trackType: "image" } });
    const project = useProjectStore.getState().project;
    const handle = { kind: "file" } as FileSystemFileHandle;
    useProjectStore.setState({ project: { ...project, mediaLibrary: { items: project.mediaLibrary.items.map((item) => ({ ...item, fileHandle: handle })) } } });
    await expect(session.commitTransaction(transaction, "Prepared edit")).rejects.toThrow(/project changed/);
    expect(useProjectStore.getState().project.mediaLibrary.items[0].fileHandle).toBe(handle);
    expect(useProjectStore.getState().project.timeline.tracks).toHaveLength(1);
  });

  it("does not publish or damage history when engine synchronization fails", async () => {
    const before = document();
    const titleEngine = useEngineStore.getState().getTitleEngine()!;
    vi.spyOn(titleEngine, "loadTextClips").mockImplementationOnce(() => { throw new Error("Engine unavailable"); });
    await expect(applySharedPreset("first", preset)).rejects.toThrow("Engine unavailable");
    expect(document()).toEqual(before);
    expect(useProjectStore.getState().canUndo()).toBe(false);
    expect(useProjectStore.getState().canRedo()).toBe(false);
  });

  it("rejects edits that become stale during asynchronous engine synchronization", async () => {
    const current = useProjectStore.getState().project;
    useProjectStore.setState({ project: { ...current, masks: [] } });
    const engines = useEngineStore.getState();
    const masks = await engines.getMaskEngine();
    let started!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => { started = resolve; });
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    vi.spyOn(engines, "getMaskEngine").mockImplementationOnce(async () => { started(); await blocked; return masks; });
    const pending = applySharedPreset("first", preset);
    await entered;
    await useProjectStore.getState().renameProject("Concurrent edit");
    release();
    await expect(pending).rejects.toThrow(/project changed/);
    expect(useProjectStore.getState().project.name).toBe("Concurrent edit");
    expect(useProjectStore.getState().project.timeline.tracks[0].clips[0].effects).toEqual([]);
  });

  it("relinks decoded local media without changing element IDs, and rejects short sources atomically", async () => {
    const bridge = getMediaBridge();
    vi.spyOn(bridge, "isInitialized").mockReturnValue(true);
    const file = new File(["replacement"], "replacement.mp4", { type: "video/mp4" });
    const decoded = {
      id: "decoded-new-id", name: file.name, type: "video" as const, blob: file,
      metadata: { duration: 6, width: 640, height: 360, frameRate: 30, codec: "avc", sampleRate: 48000, channels: 2, fileSize: file.size, mimeType: file.type, hasVideo: true, hasAudio: true, rotation: 0, canDecode: true },
      thumbnails: [], waveformData: null,
    };
    const decode = vi.spyOn(bridge, "importFile").mockResolvedValue({ success: true, media: decoded, hasWaveform: false });
    const before = document();
    await relinkSharedMedia("media", file);
    expect(useProjectStore.getState().project.mediaLibrary.items[0]).toMatchObject({ id: "media", name: file.name, isPlaceholder: false });
    expect(useProjectStore.getState().project.mediaLibrary.items[0].blob).toBe(file);
    expect(useProjectStore.getState().project.timeline.tracks[0].clips.map((clip) => clip.id)).toEqual(["first", "next"]);
    await useProjectStore.getState().undo();
    expect(document()).toEqual(before);
    decode.mockResolvedValueOnce({ success: true, media: { ...decoded, metadata: { ...decoded.metadata, duration: 2 } }, hasWaveform: false });
    await expect(relinkSharedMedia("media", file)).rejects.toThrow();
    expect(document()).toEqual(before);
    expect(useProjectStore.getState().canRedo()).toBe(true);
  });

  it("discards a failed transaction and releases the shared mutation queue", async () => {
    const before = document();
    await expect(runLocalEdit("Failed", async (session) => {
      await session.applyAction({ type: "track/add", id: "draft", timestamp: Date.now(), params: { trackType: "image" } });
      throw new Error("Cancelled");
    })).rejects.toThrow("Cancelled");
    expect(document()).toEqual(before);
    const calls: string[] = [];
    await Promise.all([runExclusive(async () => { calls.push("first"); await Promise.resolve(); calls.push("last"); }), runExclusive(async () => { calls.push("next"); })]);
    expect(calls).toEqual(["first", "last", "next"]);
  });
});
