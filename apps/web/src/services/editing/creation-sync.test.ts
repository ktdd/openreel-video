import "../../test/install-local-storage-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@openreel/core";
import { editSnapshot } from "@openreel/core/actions/handlers/edit-snapshot";
import currentProject from "../../../../../packages/core/src/test/fixtures/current-project.json";
import { useProjectStore } from "../../stores/project-store";
import { EditingSession } from "./editing-session";
import { syncCreationSceneToMotion } from "./creation-sync";

beforeEach(() => useProjectStore.getState().loadProject(structuredClone(currentProject) as unknown as Project));
afterEach(() => { vi.restoreAllMocks(); });
const snapshot = () => editSnapshot(useProjectStore.getState().getFullProject());

describe("manual creation-to-motion sync", () => {
  it("reuses binding/layer/object IDs and commits creation and render state as one undo step", async () => {
    const before = snapshot();
    const result = await syncCreationSceneToMotion({ sceneId: "creation-scene" });
    expect(result).toEqual({ compositionId: "creation-composition", layerId: "creation-layer", missingAssetObjectIds: [] });
    const after = snapshot();
    expect(after.creation?.scenes[0].renderBindings[0].objectBindings[0].renderObjectId).toBe("render-box");
    const layer = after.motionCompositions?.[0].layers.find((candidate) => candidate.id === "creation-layer");
    expect(layer?.type).toBe("scene3d");
    expect(useProjectStore.getState().actionHistory.getUndoStackSize()).toBe(1);
    await useProjectStore.getState().undo();
    expect(snapshot()).toEqual(before);
    await useProjectStore.getState().redo();
    expect(snapshot()).toEqual(after);
  });

  it("repairs a missing bound layer without creating a duplicate composition", async () => {
    const project = useProjectStore.getState().project;
    useProjectStore.setState({ project: { ...project, motionCompositions: project.motionCompositions?.map((composition) => ({ ...composition, layers: [] })) } });
    await syncCreationSceneToMotion({ sceneId: "creation-scene" });
    const compositions = useProjectStore.getState().project.motionCompositions!;
    expect(compositions).toHaveLength(1);
    expect(compositions[0].layers.some((layer) => layer.id === "creation-layer")).toBe(true);
    await syncCreationSceneToMotion({ sceneId: "creation-scene" });
    expect(useProjectStore.getState().project.motionCompositions?.[0].layers).toHaveLength(1);
  });

  it("leaves creation, render state and history untouched when a later draft action fails", async () => {
    const before = snapshot();
    const original = EditingSession.prototype.applyAction;
    vi.spyOn(EditingSession.prototype, "applyAction").mockImplementation(function (this: EditingSession, action) {
      return action.type === "motion/upsertComposition"
        ? Promise.resolve({ success: false, error: { code: "INVALID_PARAMS", message: "Rejected render update" } })
        : original.call(this, action);
    });
    await expect(syncCreationSceneToMotion({ sceneId: "creation-scene" })).rejects.toThrow("Rejected render update");
    expect(snapshot()).toEqual(before);
    expect(useProjectStore.getState().canUndo()).toBe(false);
  });
});
