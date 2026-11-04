import { describe, expect, it } from "vitest";
import type { Project } from "../types";
import type {
  MotionAudioClip,
  MotionComposition,
  MotionVideoLayer,
  MotionTextLayer,
} from "../motion/types";
import { DEFAULT_MOTION_TRANSFORM } from "../motion/types";
import type { MotionShaderDef } from "../motion/shaders/types";
import type {
  CacheRecord,
  IStorageEngine,
  MediaRecord,
  ProjectSummary,
  StorageUsage,
  WaveformRecord,
} from "./types";
import {
  ProjectSerializer,
  SCHEMA_VERSION,
  normalizeMotionComposition,
  normalizeProjectCreationFields,
  normalizeProjectMotionFields,
} from "./project-serializer";
import { createCreationScene, createEmptyCreationState } from "../creation";
import { UNIVERSAL_TRACKS_CAPABILITY } from "../timeline/timeline-items";

const makeVideoLayer = (
  overrides: Partial<MotionVideoLayer> = {},
): MotionVideoLayer => ({
  id: "layer-video-1",
  type: "video",
  name: "Clip",
  startTime: 0,
  duration: 3,
  visible: true,
  locked: false,
  transform: DEFAULT_MOTION_TRANSFORM,
  keyframes: [],
  assetId: "asset-1",
  width: 1920,
  height: 1080,
  fit: "contain",
  playbackRate: 1,
  timeOffset: 0,
  trimStart: 0,
  muted: false,
  ...overrides,
});

const makeComposition = (
  overrides: Partial<MotionComposition> = {},
): MotionComposition => ({
  id: "comp-1",
  name: "Scene",
  width: 1920,
  height: 1080,
  frameRate: 30,
  duration: 5,
  backgroundColor: "transparent",
  layers: [],
  assets: [],
  variables: [],
  markers: [],
  createdAt: 1,
  modifiedAt: 1,
  ...overrides,
});

const makeProject = (overrides: Partial<Project> = {}): Project => ({
  id: "project-1",
  name: "Project",
  createdAt: 1,
  modifiedAt: 1,
  settings: {
    width: 1920,
    height: 1080,
    frameRate: 30,
    sampleRate: 48000,
    channels: 2,
  },
  mediaLibrary: { items: [] },
  timeline: {
    tracks: [],
    subtitles: [],
    duration: 0,
    markers: [],
  },
  ...overrides,
});

class MemoryStorageEngine implements IStorageEngine {
  private projects = new Map<string, Project>();
  private media = new Map<string, MediaRecord>();

  async saveProject(project: Project): Promise<void> {
    this.projects.set(project.id, project);
  }
  async loadProject(id: string): Promise<Project | null> {
    return this.projects.get(id) ?? null;
  }
  async listProjects(): Promise<ProjectSummary[]> {
    return [...this.projects.values()].map((project) => ({
      id: project.id,
      name: project.name,
      createdAt: project.createdAt,
      modifiedAt: project.modifiedAt,
    }));
  }
  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
  }
  async saveMedia(media: MediaRecord): Promise<void> {
    this.media.set(media.id, media);
  }
  async loadMedia(id: string): Promise<MediaRecord | null> {
    return this.media.get(id) ?? null;
  }
  async deleteMedia(id: string): Promise<void> {
    this.media.delete(id);
  }
  async getMediaByProject(): Promise<MediaRecord[]> {
    return [];
  }
  async saveCache(): Promise<void> {}
  async loadCache(): Promise<CacheRecord | null> {
    return null;
  }
  async deleteCache(): Promise<void> {}
  async clearCache(): Promise<void> {}
  async saveWaveform(): Promise<void> {}
  async loadWaveform(): Promise<WaveformRecord | null> {
    return null;
  }
  async deleteWaveform(): Promise<void> {}
  async saveFileHandle(): Promise<void> {}
  async loadFileHandle(): Promise<FileSystemFileHandle | null> {
    return null;
  }
  async saveDirectoryHandle(): Promise<void> {}
  async loadDirectoryHandle(): Promise<{
    handle: FileSystemDirectoryHandle;
    folderName: string;
  } | null> {
    return null;
  }
  async getStorageUsage(): Promise<StorageUsage> {
    return { used: 0, quota: 0, projects: 0, mediaItems: 0 };
  }
  async clearAllData(): Promise<void> {}
  close(): void {}
}

describe("normalizeMotionComposition", () => {
  it("defaults audioClips to [] when missing", () => {
    const composition = makeComposition();
    expect(composition.audioClips).toBeUndefined();

    const normalized = normalizeMotionComposition(composition);

    expect(normalized.audioClips).toEqual([]);
  });

  it("preserves existing audioClips", () => {
    const audioClips: MotionAudioClip[] = [
      { id: "audio-1", startTime: 0, duration: 4, gain: 0.8 },
    ];
    const normalized = normalizeMotionComposition(
      makeComposition({ audioClips }),
    );

    expect(normalized.audioClips).toEqual(audioClips);
  });

  it("drops malformed audioClips entries", () => {
    const audioClips = [
      { id: "audio-1", startTime: 0, duration: 4 },
      null,
      { startTime: 1, duration: 2 },
    ] as unknown as MotionAudioClip[];

    const normalized = normalizeMotionComposition(
      makeComposition({ audioClips }),
    );

    expect(normalized.audioClips).toHaveLength(1);
    expect(normalized.audioClips?.[0]?.id).toBe("audio-1");
  });

  it("preserves video layers and their fields", () => {
    const videoLayer = makeVideoLayer({
      assetId: "video-asset-42",
      playbackRate: 1.5,
      trimStart: 2,
      muted: true,
    });
    const normalized = normalizeMotionComposition(
      makeComposition({ layers: [videoLayer] }),
    );

    expect(normalized.layers).toHaveLength(1);
    const layer = normalized.layers[0] as MotionVideoLayer;
    expect(layer.type).toBe("video");
    expect(layer.assetId).toBe("video-asset-42");
    expect(layer.playbackRate).toBe(1.5);
    expect(layer.trimStart).toBe(2);
    expect(layer.muted).toBe(true);
  });

  it("backfills guides/lights/tracks and is idempotent", () => {
    const composition = makeComposition();
    const once = normalizeMotionComposition(composition);
    const twice = normalizeMotionComposition(once);

    expect(once.guides).toEqual([]);
    expect(once.lights).toEqual([]);
    expect(once.tracks).toEqual([]);
    expect(twice).toEqual(once);
  });
});

describe("normalizeProjectMotionFields", () => {
  it("defaults motionCompositions and motionInstances", () => {
    const normalized = normalizeProjectMotionFields(makeProject());

    expect(normalized.motionCompositions).toEqual([]);
    expect(normalized.motionInstances).toEqual([]);
  });

  it("does not clobber existing motion instances", () => {
    const project = makeProject({
      motionInstances: [
        {
          id: "instance-1",
          compositionId: "comp-1",
          startTime: 0,
          duration: 5,
          transform: {
            position: { x: 0, y: 0 },
            scale: { x: 1, y: 1 },
            rotation: 0,
            anchor: { x: 0.5, y: 0.5 },
            opacity: 1,
            fitMode: "contain",
          },
          opacity: 1,
        },
      ],
    });

    const normalized = normalizeProjectMotionFields(project);

    expect(normalized.motionInstances).toHaveLength(1);
    expect(normalized.motionInstances?.[0]?.id).toBe("instance-1");
  });
});

describe("normalizeProjectCreationFields", () => {
  it("normalizes creation state while preserving scene records", () => {
    const creation = {
      ...createEmptyCreationState(),
      scenes: [createCreationScene({ id: "scene-creation", name: "Creation", now: 1 })],
    };
    const normalized = normalizeProjectCreationFields(makeProject({ creation }));

    expect(normalized.creation?.version).toBe(creation.version);
    expect(normalized.creation?.scenes).toHaveLength(1);
    expect(normalized.creation?.operationHistory).toEqual([]);
  });
});

describe("ProjectSerializer round-trip", () => {
  it("roundtrips current-format multi-track edits and local media through storage and project JSON", async () => {
    const serializer = new ProjectSerializer(new MemoryStorageEngine());
    const blob = new Blob(["video"], { type: "video/mp4" });
    const project = makeProject({
      mediaLibrary: { items: [{ id: "source", name: "source.mp4", type: "video", blob, fileHandle: null,
        thumbnailUrl: null, waveformData: null,
        metadata: { duration: 6, width: 1920, height: 1080, frameRate: 30, sampleRate: 48000, channels: 2, codec: "avc", fileSize: blob.size },
      }] },
      timeline: { duration: 4, subtitles: [], markers: [], tracks: ["base", "overlay"].map((id, index) => ({
        id, name: id, type: "video", groupId: "ordinary-track-group", locked: index === 1,
        hidden: index === 1, muted: index === 1, solo: index === 0, transitions: [],
        clips: [{ id: `${id}-clip`, trackId: id, mediaId: "source", startTime: 0, duration: 4, inPoint: 1, outPoint: 5,
          effects: [], audioEffects: [], volume: 0.75,
          transform: { position: { x: 0.5, y: 0.5 }, scale: { x: 0.5, y: 0.5 }, rotation: index * 15, opacity: 0.8, anchor: { x: 0.5, y: 0.5 } },
          keyframes: [{ id: `${id}-opacity`, property: "opacity", time: 1, value: 0.4, easing: "linear" }],
        }],
      })) },
    });
    await serializer.saveProject(project);
    const stored = await serializer.loadProject(project.id);
    expect(stored?.timeline).toEqual(project.timeline);
    expect(stored?.mediaLibrary.items[0].blob).toBe(blob);
    const json = serializer.exportToJson(project);
    expect(serializer.validateProjectJson(json).valid).toBe(true);
    const reopened = serializer.importFromJson(json);
    expect(reopened.timeline).toEqual(project.timeline);
    expect(reopened.mediaLibrary.items[0]).toMatchObject({ id: "source", name: "source.mp4", metadata: project.mediaLibrary.items[0].metadata, isPlaceholder: true });
  });

  it("preserves instantiated template text, animation and generic variable bindings", () => {
    const serializer = new ProjectSerializer(new MemoryStorageEngine());
    const layer: MotionTextLayer = {
      id: "legacy-template-title", type: "text", name: "Template headline",
      startTime: 0, duration: 5, visible: true, locked: false,
      transform: DEFAULT_MOTION_TRANSFORM,
      keyframes: [{ id: "fade-in", time: 0, property: "transform.opacity", value: 0, easing: "linear" }],
      text: "My saved title",
      style: { fontFamily: "Inter", fontSize: 72, fontWeight: 700, color: "#ffffff", align: "center", lineHeight: 1.2 },
      variableBindings: [{ id: "title-binding", variableId: "title", target: "text.content" }],
    };
    const composition = makeComposition({
      layers: [layer],
      variables: [{ id: "title", name: "Headline", type: "text", value: "My saved title" }],
    });
    const imported = serializer.importFromJson(serializer.exportToJson(makeProject({ motionCompositions: [composition] })));
    expect(imported.motionCompositions?.[0].layers).toEqual([layer]);
    expect(imported.motionCompositions?.[0].variables).toEqual(composition.variables);
    expect(serializer.importFromJson(serializer.exportToJson(imported))).toEqual(imported);
  });

  it("keeps previously recorded media as ordinary relinkable project content", async () => {
    const serializer = new ProjectSerializer(new MemoryStorageEngine());
    const recording = new Blob(["recorded video bytes"], { type: "video/webm" });
    const project = makeProject({
      motionCompositions: [makeComposition({
        layers: [makeVideoLayer()],
        assets: [{ id: "asset-1", type: "video", name: "Recording", mediaId: "recording-1" }],
      })],
      mediaLibrary: {
        items: [{
          id: "recording-1", name: "Screen_20260501.webm", type: "video",
          blob: recording, fileHandle: null, thumbnailUrl: null, waveformData: null,
          sourceFile: { name: "Screen_20260501.webm", size: 1024, lastModified: 1 },
          metadata: { duration: 5, width: 1920, height: 1080, frameRate: 30, codec: "vp9", sampleRate: 48000, channels: 2, fileSize: 1024 },
        }],
      },
    });
    const imported = serializer.importFromJson(serializer.exportToJson(project));
    expect(imported.mediaLibrary.items[0]).toMatchObject({
      id: "recording-1", name: "Screen_20260501.webm", type: "video",
      sourceFile: project.mediaLibrary.items[0].sourceFile,
      metadata: project.mediaLibrary.items[0].metadata,
    });
    const reopened = serializer.importFromJson(serializer.exportToJson(imported));
    expect(reopened.mediaLibrary.items).toEqual(imported.mediaLibrary.items);
    expect(reopened.motionCompositions?.[0].assets[0].mediaId).toBe("recording-1");
    expect(reopened.motionCompositions?.[0].layers[0].id).toBe("layer-video-1");
    await serializer.saveProject(project);
    const restored = await serializer.loadProject(project.id);
    expect(restored?.mediaLibrary.items[0].blob).toBe(recording);
    expect(restored?.mediaLibrary.items[0].id).toBe("recording-1");
  });

  it("writes the universal-track reader requirement and preserves it", () => {
    const serializer = new ProjectSerializer(new MemoryStorageEngine());
    const project = makeProject({
      capabilities: [UNIVERSAL_TRACKS_CAPABILITY],
      minimumReaderVersion: "1.2.0",
    });

    const json = serializer.exportToJson(project);
    const file = JSON.parse(json) as {
      version: string;
      minimumReaderVersion?: string;
      capabilities?: string[];
    };

    expect(file.version).toBe(SCHEMA_VERSION);
    expect(file.minimumReaderVersion).toBe("1.2.0");
    expect(file.capabilities).toContain(UNIVERSAL_TRACKS_CAPABILITY);
    expect(serializer.importFromJson(json).capabilities).toContain(
      UNIVERSAL_TRACKS_CAPABILITY,
    );
  });

  it("rejects a project that needs a newer reader", () => {
    const serializer = new ProjectSerializer(new MemoryStorageEngine());
    const json = JSON.stringify({
      version: "9.0.0",
      minimumReaderVersion: "9.0.0",
      project: makeProject(),
    });

    expect(() => serializer.importFromJson(json)).toThrow(
      /requires OpenReel project reader 9\.0\.0 or newer/,
    );
    expect(serializer.validateProjectJson(json)).toMatchObject({
      valid: false,
    });
  });

  it("preserves audioClips and video layers through export/import", () => {
    const serializer = new ProjectSerializer(new MemoryStorageEngine());
    const composition = makeComposition({
      layers: [makeVideoLayer()],
      audioClips: [{ id: "audio-1", startTime: 0, duration: 4 }],
    });
    const project = makeProject({ motionCompositions: [composition] });

    const json = serializer.exportToJson(project);
    const imported = serializer.importFromJson(json);

    expect(imported.motionCompositions).toHaveLength(1);
    const importedComposition = imported.motionCompositions![0];
    expect(importedComposition.audioClips).toEqual([
      { id: "audio-1", startTime: 0, duration: 4 },
    ]);
    expect(importedComposition.layers).toHaveLength(1);
    expect((importedComposition.layers[0] as MotionVideoLayer).type).toBe(
      "video",
    );
    expect((importedComposition.layers[0] as MotionVideoLayer).assetId).toBe(
      "asset-1",
    );
  });

  it("backfills audioClips when an older composition lacks it", () => {
    const serializer = new ProjectSerializer(new MemoryStorageEngine());
    const composition = makeComposition({ layers: [makeVideoLayer()] });
    const project = makeProject({ motionCompositions: [composition] });

    const imported = serializer.importFromJson(serializer.exportToJson(project));

    expect(imported.motionCompositions![0].audioClips).toEqual([]);
  });
});

const makeShaderDef = (
  overrides: Partial<MotionShaderDef> = {},
): MotionShaderDef => ({
  id: "ai-round-1",
  name: "AI Round",
  category: "fill",
  glsl: "void main(){}",
  params: [
    {
      name: "u_intensity",
      label: "Intensity",
      type: "number",
      default: 0.5,
      min: 0,
      max: 1,
      step: 0.01,
    },
  ],
  origin: "generated",
  ...overrides,
});

describe("ProjectSerializer generatedShaders", () => {
  it("round-trips a valid generated shader through export/import", () => {
    const serializer = new ProjectSerializer(new MemoryStorageEngine());
    const def = makeShaderDef();
    const project = makeProject({ generatedShaders: [def] });

    const imported = serializer.importFromJson(serializer.exportToJson(project));

    expect(imported.generatedShaders).toEqual([def]);
  });

  it("drops malformed generated shaders on import", () => {
    const serializer = new ProjectSerializer(new MemoryStorageEngine());
    const valid = makeShaderDef();
    const badCategory = makeShaderDef({ id: "ai-bad-cat", category: "wrong" as MotionShaderDef["category"] });
    const missingGlsl = { ...makeShaderDef({ id: "ai-no-glsl" }), glsl: undefined };
    const project = makeProject({
      generatedShaders: [valid, badCategory, missingGlsl] as MotionShaderDef[],
    });

    const imported = serializer.importFromJson(serializer.exportToJson(project));

    expect(imported.generatedShaders?.map((d) => d.id)).toEqual(["ai-round-1"]);
  });

  it("defaults generatedShaders to an empty array when absent", () => {
    const serializer = new ProjectSerializer(new MemoryStorageEngine());
    const project = makeProject();

    const imported = serializer.importFromJson(serializer.exportToJson(project));

    expect(imported.generatedShaders).toEqual([]);
  });
});
