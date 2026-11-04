import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCreationMotionSceneBinding } from "../creation/render-binding";
import { validateCreationState } from "../creation/runtime";
import { createPortableEdit, materializePortableEdit, parsePortableEdit } from "../editing/portable-project";
import { ProjectSerializer } from "../storage/project-serializer";
import { StorageEngine } from "../storage/storage-engine";
import { parseSRT } from "../text/subtitle-engine";
import type { Project } from "../types/project";
import legacy from "./fixtures/ai-removal/legacy-ai-project.json";
import ordinary from "./fixtures/ai-removal/ordinary-project.json";
import { createFixtureWav } from "./fixtures/ai-removal/media";

const fixtureText = (name: string): string =>
  readFileSync(new URL(`./fixtures/ai-removal/${name}`, import.meta.url), "utf8");

// Frozen legacy JSON is intentional: rebuilding it with current defaults would hide migration regressions.
const serializer = (): ProjectSerializer => new ProjectSerializer(new StorageEngine());
const openLegacy = (): Project => serializer().importFromJson(JSON.stringify(legacy));
const openOrdinary = (): Project => serializer().importFromJson(JSON.stringify(ordinary));

describe("AI removal Phase 0 compatibility fixtures", () => {
  beforeEach(() => {
    const unexpected = (): never => { throw new Error("Fixtures must not use the network, workers, or IndexedDB"); };
    vi.stubGlobal("fetch", vi.fn(unexpected));
    vi.stubGlobal("Worker", vi.fn(unexpected));
    vi.stubGlobal("indexedDB", { open: vi.fn(unexpected) });
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it.each([ordinary, legacy])("validates and round-trips frozen project $project.id without executing AI", (document) => {
    const reader = serializer();
    const json = JSON.stringify(document);
    expect(reader.validateProjectJson(json).errors).toEqual([]);
    const project = reader.importFromJson(json);
    const restored = reader.importFromJson(reader.exportToJson(project));
    expect(restored.id).toBe(document.project.id);
    expect(restored.timeline).toEqual(project.timeline);
    expect(restored.textClips).toEqual(project.textClips);
    expect(restored.generatedShaders).toEqual(project.generatedShaders);
    expect(restored.creation).toEqual(project.creation);
    expect(restored.motionCompositions).toEqual(project.motionCompositions);
    expect(restored.motionInstances).toEqual(project.motionInstances);
    expect(fetch).not.toHaveBeenCalled();
    expect(Worker).not.toHaveBeenCalled();
    expect(indexedDB.open).not.toHaveBeenCalled();
  });

  it("preserves trim, captions and stable IDs through portable edit sharing", () => {
    const project = openOrdinary();
    const document = parsePortableEdit(JSON.stringify(createPortableEdit(project)));
    const restored = materializePortableEdit(document, project).project;
    expect(restored.timeline.tracks[0].clips[0]).toMatchObject({
      id: "trimmed-tone", mediaId: "tone-media", startTime: 0, duration: 2, inPoint: 0.5, outPoint: 2.5,
    });
    expect(restored.timeline.subtitles[0]).toMatchObject({ text: "Manual caption", startTime: 0, endTime: 1 });
    expect(restored.mediaLibrary.items[0].id).toBe("tone-media");
  });

  it("provides real deterministic WAV bytes and equivalent SRT/VTT caption inputs", () => {
    const bytes = createFixtureWav();
    const view = new DataView(bytes.buffer);
    expect(bytes).toEqual(createFixtureWav());
    expect(bytes.length).toBe(ordinary.project.mediaLibrary.items[0].metadata.fileSize);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("RIFF");
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint32(40, true) / 2 / 8000).toBe(3);
    const cues = (text: string) => {
      const result = parseSRT(text);
      expect(result.success).toBe(true);
      return result.subtitles.map(({ text, startTime, endTime }) => ({ text, startTime, endTime }));
    };
    expect(cues(fixtureText("captions.srt"))).toEqual(cues(fixtureText("captions.vtt")));
  });

  it("restores completed generated media from local storage without fetching its origin", async () => {
    const project = openLegacy();
    const svg = fixtureText("completed-generation.svg");
    const blob = new Blob([svg], { type: "image/svg+xml" });
    expect(blob.size).toBe(project.mediaLibrary.items[0].sourceFile?.size);
    const linked: Project = {
      ...project,
      mediaLibrary: { items: project.mediaLibrary.items.map((item) => item.id === "completed-image" ? { ...item, blob, isPlaceholder: false } : item) },
    };
    const storage = new StorageEngine();
    let saved: Project | null = null;
    vi.spyOn(storage, "saveMedia").mockResolvedValue(undefined);
    vi.spyOn(storage, "saveProject").mockImplementation(async (value) => { saved = value; });
    vi.spyOn(storage, "loadProject").mockImplementation(async () => saved);
    vi.spyOn(storage, "loadMedia").mockImplementation(async (id) => id === "completed-image" ? {
      id, projectId: project.id, blob, metadata: project.mediaLibrary.items[0].metadata,
    } : null);
    const reader = new ProjectSerializer(storage);
    await reader.saveProject(linked);
    const restored = await reader.loadProject(project.id);
    const media = restored?.mediaLibrary.items.find((item) => item.id === "completed-image");
    expect(media?.blob).toBe(blob);
    expect(await media?.blob?.text()).toBe(svg);
    expect(restored?.timeline.tracks[1].clips[0].mediaId).toBe("completed-image");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("includes unfinished job references and legacy live effects as inert input data", () => {
    // This checks fixture coverage, not a requirement for future readers to preserve obsolete flags.
    expect(legacy.project.mediaLibrary.items.find((item) => item.id === "pending-image")).toMatchObject({
      isPending: true, kieaiTaskId: "synthetic-task-pending", blob: null,
    });
    expect(legacy.project.mediaLibrary.items.find((item) => item.id === "failed-image")).toMatchObject({ kieaiError: true });
    expect(legacy.project.textClips[0]).toMatchObject({
      behindSubject: true, text: "Keep this title visible", metadata: { captionSource: "whisper" },
    });
    expect(openLegacy().timeline.subtitles[0].words).toHaveLength(3);
  });

  it("keeps saved shader definitions and creation-to-motion binding references", () => {
    const project = openLegacy();
    const shader = project.generatedShaders?.[0];
    expect(shader).toMatchObject({ id: "ai-phase0-saved-fill", origin: "generated" });
    expect(shader?.glsl).toContain("#version 300 es");
    const text = project.motionCompositions?.[0].layers.find((layer) => layer.type === "text");
    expect(text?.type === "text" && text.style.fillShader?.shaderId).toBe(shader?.id);
    expect(project.creation).toBeDefined();
    expect(validateCreationState(project.creation!).filter((issue) => issue.severity === "error")).toEqual([]);
    const binding = resolveCreationMotionSceneBinding(project.creation, "creation-composition", "creation-layer");
    expect(binding?.scene.id).toBe("creation-scene");
    expect(binding?.binding.objectBindings[0]).toEqual({ sceneObjectId: "creation-box", renderObjectId: "render-box" });
    expect(project.motionCompositions?.[0].layers.some((layer) => layer.id === binding?.binding.layerId)).toBe(true);
  });
});
