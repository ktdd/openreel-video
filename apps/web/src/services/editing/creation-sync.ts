import { buildMotionScene3DFromCreation } from "@openreel/core/creation/creation-to-motion";
import type { CreationRenderBinding } from "@openreel/core/creation";
import type { MotionComposition } from "@openreel/core";
import { runLocalEdit } from "./portable-edits";

export interface CreationSyncOptions {
  readonly sceneId: string;
  readonly compositionId?: string;
  readonly layerId?: string;
}
export interface CreationSyncResult {
  readonly compositionId: string;
  readonly layerId: string;
  readonly missingAssetObjectIds: readonly string[];
}

/** Rebuild a persisted semantic scene through ordinary isolated, undoable editing actions. */
export function syncCreationSceneToMotion(options: CreationSyncOptions): Promise<CreationSyncResult> {
  return runLocalEdit("Sync creation scene to Motion", async (session) => {
    const project = session.getProject();
    const creation = project.creation;
    const scene = creation?.scenes.find((candidate) => candidate.id === options.sceneId);
    if (!creation || !scene) throw new Error("Creation scene not found");
    if (!scene.objects.length) throw new Error("Creation scene has no objects to render");
    const bindings = scene.renderBindings.filter((candidate) => candidate.kind === "motion-scene3d");
    const binding = bindings.find((candidate) =>
      (options.compositionId && candidate.compositionId === options.compositionId) ||
      (options.layerId && candidate.layerId === options.layerId),
    ) ?? (!options.compositionId && !options.layerId ? bindings[0] : undefined);
    const compositionId = options.compositionId ?? binding?.compositionId ?? crypto.randomUUID();
    const layerId = options.layerId ?? binding?.layerId ?? crypto.randomUUID();
    const existing = project.motionCompositions?.find((candidate) => candidate.id === compositionId);
    const existingLayer = existing?.layers.find((candidate) => candidate.id === layerId);
    if (existingLayer && existingLayer.type !== "scene3d") throw new Error("The bound Motion layer is not a scene3d layer");
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const width = clamp(existing?.width ?? project.settings.width, 320, 8192);
    const height = clamp(existing?.height ?? project.settings.height, 320, 8192);
    const duration = clamp(existing?.duration ?? scene.duration, 0.5, 120);
    const frameRate = clamp(existing?.frameRate ?? scene.frameRate, 12, 120);
    const name = existing?.name ?? scene.name;
    const rebuilt = buildMotionScene3DFromCreation(scene, creation.assets, {
      compositionWidth: width, compositionHeight: height, duration, layerName: name, layerId, binding,
      existingLayer: existingLayer?.type === "scene3d" ? existingLayer : undefined,
    });
    const now = Date.now();
    const nextBinding: CreationRenderBinding = {
      ...binding, id: binding?.id ?? `binding-${scene.id}-${compositionId}`, kind: "motion-scene3d",
      compositionId, layerId, objectBindings: rebuilt.objectBindings, createdAt: binding?.createdAt ?? now, modifiedAt: now,
    };
    const nextScene = {
      ...scene, modifiedAt: now,
      renderBindings: binding ? scene.renderBindings.map((candidate) => candidate.id === binding.id ? nextBinding : candidate) : [...scene.renderBindings, nextBinding],
    };
    const composition: MotionComposition = {
      ...(existing ?? { id: compositionId, assets: [], variables: [], markers: [], guides: [], createdAt: now }),
      name, width, height, duration, frameRate, modifiedAt: now,
      backgroundColor: scene.environment.backgroundColor ?? existing?.backgroundColor ?? "#0f172a",
      layers: existingLayer ? existing!.layers.map((candidate) => candidate.id === layerId ? rebuilt.layer : candidate) : [...(existing?.layers ?? []), rebuilt.layer],
    };
    for (const action of [
      { type: "creation/applyOperation", params: { operation: { id: crypto.randomUUID(), type: "scene/upsert", timestamp: now, source: "user", label: `Sync ${scene.name} to Motion`, scene: nextScene } } },
      { type: "motion/upsertComposition", params: { composition } },
    ]) {
      const result = await session.applyAction({ ...action, id: crypto.randomUUID(), timestamp: now });
      if (!result.success) throw new Error(result.error?.message ?? "Could not sync render scene");
    }
    return { compositionId, layerId, missingAssetObjectIds: rebuilt.missingAssetObjectIds };
  });
}
