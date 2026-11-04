import { describe, expect, it } from "vitest";
import type { Project } from "../types/project";
import legacy from "../test/fixtures/ai-removal/legacy-ai-project.json";
import { buildMotionScene3DFromCreation } from "./creation-to-motion";
import type { CreationScene } from "./schema/types";
import type { MotionScene3DLayer } from "../motion/types";

describe("semantic creation scene conversion", () => {
  it("preserves bound IDs, manual layer controls and unrelated keyframes while rebuilding semantic animation", () => {
    const project = structuredClone(legacy.project) as unknown as Project;
    const creation = project.creation!;
    const original = project.motionCompositions![0].layers.find((layer) => layer.id === "creation-layer") as MotionScene3DLayer;
    const scene: CreationScene = { ...creation.scenes[0], animations: [{
      id: "animation", name: "Move and zoom", duration: 3,
      tracks: [
        { id: "move", targetId: "creation-box", channel: "position", keyframes: [{ time: 1, value: { x: 2, y: 3, z: 4 }, easing: "linear" }] },
        { id: "zoom", targetId: "creation-camera", channel: "camera.fov", keyframes: [{ time: 2, value: 45, easing: "ease-out" }] },
      ],
    }] };
    const existingLayer: MotionScene3DLayer = { ...original, locked: true, startTime: 1, keyframes: [
      { id: "manual", time: 0, property: "transform.opacity", value: 0.5, easing: "linear" },
      { id: "stale", time: 0, property: "scene.object.deleted.position.x", value: 10, easing: "linear" },
    ] };
    const result = buildMotionScene3DFromCreation(scene, creation.assets, {
      compositionWidth: 640, compositionHeight: 360, duration: 3,
      layerId: "creation-layer", layerName: "Scene", binding: scene.renderBindings[0], existingLayer,
    });
    expect(result.layer.id).toBe("creation-layer");
    expect(result.objectBindings).toEqual([{ sceneObjectId: "creation-box", renderObjectId: "render-box" }]);
    expect(result.layer).toMatchObject({ locked: true, startTime: 1, transform: original.transform });
    expect(result.layer.keyframes).toContainEqual(existingLayer.keyframes[0]);
    expect(result.layer.keyframes.some((keyframe) => keyframe.id === "stale")).toBe(false);
    expect(result.layer.keyframes).toContainEqual(expect.objectContaining({ property: "scene.object.render-box.position.x", time: 1, value: 2 }));
    expect(result.layer.keyframes).toContainEqual(expect.objectContaining({ property: "scene.camera.fov", time: 2, value: 45 }));
    expect(result.missingAssetObjectIds).toEqual([]);
    expect(existingLayer.keyframes).toHaveLength(2);
  });
});
