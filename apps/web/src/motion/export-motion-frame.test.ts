import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MotionComposition, Project } from "@openreel/core";
import { createEmptyProject } from "../stores/project/project-helpers";
import { exportMotionCompositionSceneMp4, motionFrameExportFilename, motionSceneExportFilename } from "./export-motion-frame";

const { createDownloadWritableMock, exportVideoMock, initializeMock } = vi.hoisted(() => ({
  createDownloadWritableMock: vi.fn(), exportVideoMock: vi.fn(), initializeMock: vi.fn(),
}));
vi.mock("../services/export-runner", () => ({
  createDownloadWritable: createDownloadWritableMock,
  mimeForExt: () => "video/mp4",
}));
vi.mock("@openreel/core", async (importOriginal) => ({
  ...await importOriginal<typeof import("@openreel/core")>(),
  getExportEngine: () => ({ initialize: initializeMock, exportVideo: exportVideoMock }),
}));
const composition: MotionComposition = {
  id: "comp-1", name: "Launch Scene!", width: 1920, height: 1080,
  frameRate: 30, duration: 5, backgroundColor: "#111827", layers: [], assets: [],
  variables: [], markers: [], createdAt: 1, modifiedAt: 1,
};

describe("motion frame export helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createDownloadWritableMock.mockResolvedValue({ close: vi.fn() });
    initializeMock.mockResolvedValue(undefined);
  });
  it("builds stable filenames", () => {
    expect(motionFrameExportFilename(composition, 1.25)).toBe("launch-scene-frame-00038.png");
    expect(motionSceneExportFilename(composition)).toBe("launch-scene.mp4");
  });
  it("exports a real temporary motion-instance project through the browser export engine", async () => {
    const original = createEmptyProject("Original");
    const before = JSON.stringify(original);
    let exportedProject: Project | undefined;
    let exportedSettings: unknown;
    exportVideoMock.mockImplementation(async function* (project: Project, settings: unknown) {
      exportedProject = project;
      exportedSettings = settings;
      yield { phase: "rendering", progress: 0.5, estimatedTimeRemaining: 1, currentFrame: 75, totalFrames: 150 };
      return { success: true, stats: { framesRendered: 150 } };
    });
    const onProgress = vi.fn();
    const result = await exportMotionCompositionSceneMp4({ project: original, composition, onProgress });
    expect(createDownloadWritableMock).toHaveBeenCalledWith("launch-scene.mp4", "video/mp4");
    expect(initializeMock).toHaveBeenCalledOnce();
    expect(onProgress).toHaveBeenCalledOnce();
    expect(exportedProject?.settings).toMatchObject({ width: 1920, height: 1080, frameRate: 30 });
    expect(exportedProject?.timeline.tracks).toHaveLength(1);
    expect(exportedProject?.motionInstances).toHaveLength(1);
    expect(exportedProject?.motionCompositions?.[0].id).toBe("comp-1");
    expect(exportedSettings).toMatchObject({ format: "mp4", codec: "h264", width: 1920, height: 1080, frameRate: 30 });
    expect(result).toMatchObject({ filename: "launch-scene.mp4", framesRendered: 150 });
    expect(JSON.stringify(original)).toBe(before);
  });
});
