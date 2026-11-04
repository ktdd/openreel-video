// Deterministic semantic-scene conversion extracted from the former agent implementation.
import { createMotionScene3DLayer, MOTION_OBJECT_3D_KINDS } from "../motion/motion-scene3d";
import { type MotionMaterial3D, type MotionObject3D, type MotionObject3DKind, type MotionObjectMeshData, type MotionScene3DLayer, type MotionSceneObject3D, type MotionScene3DCamera, type MotionScene3DLighting, type MotionScene3DRoom } from "../motion/types";
import type { Keyframe } from "../types/timeline";
import { bakeRecipeMesh } from "./geometry/bake";
import type { Vec3 as CreationVec3 } from "./schema/common";
import type { CreationAnimationKeyframe, CreationAnimationTrack, CreationAssetRecipe, CreationMaterial, CreationRenderBinding, CreationRenderObjectBinding, CreationScene, CreationSceneObject } from "./schema/types";

export function buildMotionScene3DFromCreation(
  scene: CreationScene,
  assets: readonly CreationAssetRecipe[],
  options: {
    readonly compositionWidth: number;
    readonly compositionHeight: number;
    readonly layerId: string;
    readonly layerName: string;
    readonly duration: number;
    readonly binding?: CreationRenderBinding;
    readonly existingLayer?: MotionScene3DLayer;
  },
): {
  readonly layer: MotionScene3DLayer;
  readonly objectBindings: CreationRenderBinding["objectBindings"];
  readonly renderObjectIdsBySceneObjectId: Record<string, string>;
  readonly missingAssetObjectIds: string[];
} {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const existingObjectById = new Map(
    (options.existingLayer?.objects ?? []).map((object) => [object.id, object]),
  );
  const usedRenderIds = new Set<string>();
  const renderObjectIdMap = new Map<string, string>();
  const objectBindings: CreationRenderObjectBinding[] = [];
  const objects: MotionSceneObject3D[] = [];
  const missingAssetObjectIds: string[] = [];
  const bakeMeshCache = new Map<string, MotionObjectMeshData | null>();
  for (const object of scene.objects) {
    const asset = assetById.get(object.assetId);
    if (!asset) missingAssetObjectIds.push(object.id);
    const renderObjectId = renderObjectIdForCreationObject(
      scene,
      object,
      options.binding,
      usedRenderIds,
    );
    renderObjectIdMap.set(object.id, renderObjectId);
    objectBindings.push({ sceneObjectId: object.id, renderObjectId });
    objects.push(
      motionSceneObjectFromCreation(
        object,
        asset,
        renderObjectId,
        existingObjectById.get(renderObjectId),
        bakeMeshCache,
      ),
    );
  }

  const camera = cameraForCreationScene(scene);
  const baseLayer = createMotionScene3DLayer({
    id: options.layerId,
    name: options.layerName,
    duration: options.duration,
    compositionWidth: options.compositionWidth,
    compositionHeight: options.compositionHeight,
    object: { kind: "box" },
    objects,
    camera,
    room: roomForCreationScene(scene),
    lighting: lightingForCreationScene(scene),
    fov: camera.fov,
    width: options.compositionWidth,
    height: options.compositionHeight,
  });
  const validRenderObjectIds = new Set(renderObjectIdMap.values());
  const semanticKeyframes = creationSceneAnimationKeyframes(scene, renderObjectIdMap);
  const keyframes = mergeSceneKeyframes(
    preservedScene3DKeyframes(options.existingLayer, validRenderObjectIds),
    semanticKeyframes,
  );
  const layer: MotionScene3DLayer = {
    ...baseLayer,
    startTime: options.existingLayer?.startTime ?? baseLayer.startTime,
    visible: options.existingLayer?.visible ?? baseLayer.visible,
    locked: options.existingLayer?.locked ?? baseLayer.locked,
    transform: options.existingLayer?.transform ?? baseLayer.transform,
    keyframes,
  };
  return {
    layer,
    objectBindings,
    renderObjectIdsBySceneObjectId: Object.fromEntries(renderObjectIdMap),
    missingAssetObjectIds,
  };
}

function renderObjectIdForCreationObject(
  scene: CreationScene,
  object: CreationSceneObject,
  binding: CreationRenderBinding | undefined,
  used: Set<string>,
): string {
  const existing = binding?.objectBindings.find(
    (candidate) => candidate.sceneObjectId === object.id,
  )?.renderObjectId;
  const base =
    existing ??
    `obj-${idSegment(scene.id, "scene")}-${idSegment(
      object.partId ?? object.name ?? object.id,
      "object",
    )}`;
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  used.add(candidate);
  return candidate;
}

function idSegment(value: unknown, fallback: string): string {
  const source = optionalString(value) ?? fallback;
  const normalized = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function motionSceneObjectFromCreation(
  object: CreationSceneObject,
  asset: CreationAssetRecipe | undefined,
  renderObjectId: string,
  existing?: MotionSceneObject3D,
  bakeMeshCache?: Map<string, MotionObjectMeshData | null>,
): MotionSceneObject3D {
  const material = materialForCreationSceneObject(asset, object);
  const parameters = creationGeometryParameters(asset);
  return {
    id: renderObjectId,
    name: object.name,
    object: motionObjectFromCreationAsset(asset, object, existing, bakeMeshCache),
    material: material
      ? motionMaterialForCreation(material)
      : existing?.material ?? {
          kind: "physical",
          color: "#cbd5e1",
          metalness: 0,
          roughness: 0.65,
        },
    transform3d: {
      position: object.transform.position,
      rotation: object.transform.rotation,
      scale: object.transform.scale,
    },
    lidAngle:
      creationParameterNumber(parameters, "lidAngle") ?? existing?.lidAngle,
    opacity:
      material?.opacity ??
      creationParameterNumber(parameters, "opacity") ??
      existing?.opacity,
  };
}

function materialForCreationSceneObject(
  asset: CreationAssetRecipe | undefined,
  object: CreationSceneObject,
): CreationMaterial | undefined {
  return (
    asset?.materials.find((material) => material.id === object.materialId) ??
    asset?.materials[0]
  );
}

function creationGeometryParameters(
  asset: CreationAssetRecipe | undefined,
): Record<string, unknown> {
  if (!asset) return {};
  const geometryNode = asset.nodes.find(
    (node) =>
      node.type === "primitive" ||
      node.type === "cache" ||
      node.type === "product-part" ||
      node.type === "curve",
  );
  return {
    ...asRecord(asset.parameters),
    ...asRecord(geometryNode?.parameters),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function motionObjectFromCreationAsset(
  asset: CreationAssetRecipe | undefined,
  object: CreationSceneObject,
  existing?: MotionSceneObject3D,
  bakeMeshCache?: Map<string, MotionObjectMeshData | null>,
): MotionObject3D {
  if (existing) return existing.object;
  const parameters = creationGeometryParameters(asset);
  let kind =
    creationMotionObjectKind(parameters.motionObjectKind) ??
    creationMotionObjectKind(parameters.kind);
  if (!kind) {
    if (asset?.kind === "ui" && creationParameterString(parameters, "text")) {
      kind = "text3d";
    } else if (asset?.kind === "product" && asset.nodes.some((node) => node.type === "product-part")) {
      kind = "rounded-box";
    } else {
      kind = "box";
    }
  }
  const modelUrl =
    kind === "model"
      ? creationParameterString(parameters, "modelUrl") ?? meshDependencyUrl(asset)
      : undefined;
  if (kind === "model" && !modelUrl) kind = "box";
  const text =
    kind === "text3d"
      ? creationParameterString(parameters, "text") ?? object.name
      : undefined;
  const mesh =
    kind === "model" || kind === "text3d" || !assetNeedsBakedMesh(asset)
      ? undefined
      : bakeAssetMeshCached(asset!, bakeMeshCache) ?? undefined;
  return {
    kind,
    mesh,
    size: creationParameterNumber(parameters, "size"),
    depth: creationParameterNumber(parameters, "depth"),
    aspect: creationParameterNumber(parameters, "aspect"),
    cornerRadius: creationParameterNumber(parameters, "cornerRadius"),
    modelUrl,
    animation: kind === "model" ? motionModelAnimationFromArgs(parameters) : undefined,
    text,
    extrude:
      kind === "text3d"
        ? creationParameterNumber(parameters, "extrude")
        : undefined,
    panelTexts:
      kind === "soccer-ball"
        ? creationParameterStringArray(parameters, "panelTexts")
        : undefined,
  };
}

function creationMotionObjectKind(
  value: unknown,
): MotionObject3DKind | undefined {
  const kind = optionalString(value);
  return kind && MOTION_OBJECT_3D_KINDS.includes(kind as never)
    ? (kind as MotionObject3DKind)
    : undefined;
}

function creationParameterString(
  parameters: Record<string, unknown>,
  key: string,
): string | undefined {
  return optionalString(parameters[key]);
}

function meshDependencyUrl(asset: CreationAssetRecipe | undefined): string | undefined {
  return asset?.dependencies.find((dependency) => dependency.kind === "mesh")?.uri;
}

function assetNeedsBakedMesh(asset: CreationAssetRecipe | undefined): boolean {
  if (!asset) return false;
  return asset.nodes.some((node) => BAKED_MESH_NODE_TYPES.has(node.type));
}

const BAKED_MESH_NODE_TYPES: ReadonlySet<string> = new Set([
  "deform",
  "subdivision",
  "sdf",
  "array",
]);

function bakeAssetMeshCached(
  asset: CreationAssetRecipe,
  cache?: Map<string, MotionObjectMeshData | null>,
): MotionObjectMeshData | null {
  if (!cache) return bakeAssetToMotionObjectMesh(asset);
  if (!cache.has(asset.id)) {
    cache.set(asset.id, bakeAssetToMotionObjectMesh(asset));
  }
  return cache.get(asset.id) ?? null;
}

function bakeAssetToMotionObjectMesh(
  asset: CreationAssetRecipe,
): MotionObjectMeshData | null {
  try {
    const baked = bakeRecipeMesh(asset, { quality: "preview" });
    if (baked.placeholder) return null;
    const mesh = baked.mesh;
    if (mesh.positions.length < 9 || mesh.indices.length < 3) return null;
    return {
      positions: Array.from(mesh.positions),
      normals: Array.from(mesh.normals),
      uvs: Array.from(mesh.uvs),
      indices: Array.from(mesh.indices),
    };
  } catch {
    return null;
  }
}

function creationParameterNumber(
  parameters: Record<string, unknown>,
  key: string,
): number | undefined {
  return optionalNumber(parameters[key]);
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function motionModelAnimationFromArgs(
  raw: Record<string, unknown>,
): MotionObject3D["animation"] | undefined {
  const nested = asRecord(raw.animation);
  const clipName = optionalString(
    raw.animationClipName ??
      raw.clipName ??
      raw.animationName ??
      nested?.clipName ??
      raw.animation,
  );
  const clipIndex = optionalNumber(
    raw.animationClipIndex ?? raw.clipIndex ?? nested?.clipIndex,
  );
  const timeOffset = optionalNumber(
    raw.animationTimeOffset ?? raw.timeOffset ?? nested?.timeOffset,
  );
  const playbackRate = optionalNumber(
    raw.animationPlaybackRate ?? raw.playbackRate ?? nested?.playbackRate,
  );
  const loop =
    typeof raw.animationLoop === "boolean"
      ? raw.animationLoop
      : typeof nested?.loop === "boolean"
        ? nested.loop
      : typeof raw.loop === "boolean"
        ? raw.loop
        : undefined;
  if (
    clipName === undefined &&
    clipIndex === undefined &&
    timeOffset === undefined &&
    playbackRate === undefined &&
    loop === undefined
  ) {
    return undefined;
  }
  return {
    ...(clipName !== undefined ? { clipName } : {}),
    ...(clipIndex !== undefined ? { clipIndex: Math.max(0, Math.floor(clipIndex)) } : {}),
    ...(timeOffset !== undefined ? { timeOffset: Math.max(0, timeOffset) } : {}),
    ...(playbackRate !== undefined ? { playbackRate } : {}),
    ...(loop !== undefined ? { loop } : {}),
  };
}

function creationParameterStringArray(
  parameters: Record<string, unknown>,
  key: string,
): string[] | undefined {
  return parseStringArray(parameters[key]);
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry === "string" && entry.trim()) result.push(entry.trim());
  }
  return result.length > 0 ? result : undefined;
}

function motionMaterialForCreation(material: CreationMaterial): MotionMaterial3D {
  const isGlass = material.model === "glass";
  const transmission =
    material.transmission ??
    optionalNumber(material.parameters?.transmission) ??
    (isGlass ? 0.9 : undefined);
  return {
    kind:
      material.model === "screen" || material.model === "emissive"
        ? "basic"
        : "physical",
    color: material.baseColor,
    metalness: material.metallic,
    roughness: material.roughness,
    opacity: material.opacity,
    emissive: material.emissive,
    emissiveIntensity: material.emissiveIntensity,
    mapAssetId: optionalString(material.parameters?.mapAssetId),
    normalMapAssetId: optionalString(material.parameters?.normalMapAssetId),
    roughnessMapAssetId: optionalString(material.parameters?.roughnessMapAssetId),
    metalnessMapAssetId: optionalString(material.parameters?.metalnessMapAssetId),
    transmission,
    ior: optionalNumber(material.parameters?.ior) ?? (isGlass ? 1.5 : undefined),
    clearcoat: material.clearcoat ?? optionalNumber(material.parameters?.clearcoat),
    clearcoatRoughness: optionalNumber(material.parameters?.clearcoatRoughness),
  };
}

function cameraForCreationScene(scene: CreationScene): MotionScene3DCamera {
  const camera =
    scene.cameras.find((candidate) => candidate.id === scene.activeCameraId) ??
    scene.cameras[0];
  return {
    position: camera?.position ?? { x: 0, y: 3, z: 12 },
    target: camera?.target ?? { x: 0, y: 0, z: 0 },
    fov: camera?.fov ?? 35,
    near: 0.05,
    far: 120,
  };
}

function roomForCreationScene(scene: CreationScene): MotionScene3DRoom {
  return {
    enabled: scene.environment.groundEnabled ?? true,
    size: 12,
    wallColor: scene.environment.backgroundColor ?? "#0f172a",
    floorColor: scene.environment.groundColor ?? scene.environment.backgroundColor ?? "#111827",
  };
}

function lightingForCreationScene(scene: CreationScene): MotionScene3DLighting {
  const ambientLight = scene.lights.find((light) => light.kind === "ambient");
  const keyLight = scene.lights.find((light) => light.kind !== "ambient");
  return {
    ambient: ambientLight?.intensity ?? 0.45,
    keyIntensity: keyLight?.intensity ?? 1.8,
    keyColor: keyLight?.color ?? "#ffffff",
    rimIntensity: scene.environment.kind === "space" ? 0.8 : 0.45,
    environment:
      scene.environment.kind === "none"
        ? "none"
        : scene.environment.kind === "space"
          ? "dark"
          : "studio",
    groundShadow: scene.environment.groundEnabled ?? false,
  };
}

function creationSceneAnimationKeyframes(
  scene: CreationScene,
  renderObjectIdsBySceneObjectId: ReadonlyMap<string, string>,
): Keyframe[] {
  const keyframes: Keyframe[] = [];
  for (const clip of scene.animations) {
    for (const object of scene.objects) {
      const renderObjectId = renderObjectIdsBySceneObjectId.get(object.id);
      if (!renderObjectId) continue;
      const tracks = clip.tracks.filter((track) => track.targetId === object.id);
      keyframes.push(...motionKeyframesForCreationObjectTracks(renderObjectId, tracks, genId));
    }
    for (const camera of scene.cameras) {
      const tracks = clip.tracks.filter((track) => track.targetId === camera.id);
      keyframes.push(...motionKeyframesForCreationCameraTracks(tracks, genId));
    }
  }
  return keyframes;
}

function motionKeyframesForCreationObjectTracks(
  renderObjectId: string,
  tracks: readonly CreationAnimationTrack[],
  idFactory: () => string,
): Keyframe[] {
  const keyframes: Keyframe[] = [];
  const prefix = `scene.object.${renderObjectId}`;
  for (const track of tracks) {
    if (
      track.channel === "position" ||
      track.channel === "rotation" ||
      track.channel === "scale"
    ) {
      for (const keyframe of track.keyframes as readonly CreationAnimationKeyframe<CreationVec3>[]) {
        keyframes.push(
          {
            id: idFactory(),
            time: keyframe.time,
            property: `${prefix}.${track.channel}.x`,
            value: keyframe.value.x,
            easing: keyframe.easing,
          },
          {
            id: idFactory(),
            time: keyframe.time,
            property: `${prefix}.${track.channel}.y`,
            value: keyframe.value.y,
            easing: keyframe.easing,
          },
          {
            id: idFactory(),
            time: keyframe.time,
            property: `${prefix}.${track.channel}.z`,
            value: keyframe.value.z,
            easing: keyframe.easing,
          },
        );
      }
    } else if (track.channel === "opacity") {
      for (const keyframe of track.keyframes as readonly CreationAnimationKeyframe<number>[]) {
        keyframes.push({
          id: idFactory(),
          time: keyframe.time,
          property: `${prefix}.opacity`,
          value: keyframe.value,
          easing: keyframe.easing,
        });
      }
    }
  }
  return keyframes;
}

const genId = (): string =>
  (
    globalThis as unknown as { crypto?: { randomUUID?: () => string } }
  ).crypto?.randomUUID?.() ??
  `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function motionKeyframesForCreationCameraTracks(
  tracks: readonly CreationAnimationTrack[],
  idFactory: () => string,
): Keyframe[] {
  const keyframes: Keyframe[] = [];
  for (const track of tracks) {
    if (track.channel === "camera.position" || track.channel === "camera.target") {
      const prefix =
        track.channel === "camera.position"
          ? "scene.camera.position"
          : "scene.camera.target";
      for (const keyframe of track.keyframes as readonly CreationAnimationKeyframe<CreationVec3>[]) {
        keyframes.push(
          {
            id: idFactory(),
            time: keyframe.time,
            property: `${prefix}.x`,
            value: keyframe.value.x,
            easing: keyframe.easing,
          },
          {
            id: idFactory(),
            time: keyframe.time,
            property: `${prefix}.y`,
            value: keyframe.value.y,
            easing: keyframe.easing,
          },
          {
            id: idFactory(),
            time: keyframe.time,
            property: `${prefix}.z`,
            value: keyframe.value.z,
            easing: keyframe.easing,
          },
        );
      }
    } else if (track.channel === "camera.fov") {
      for (const keyframe of track.keyframes as readonly CreationAnimationKeyframe<number>[]) {
        keyframes.push({
          id: idFactory(),
          time: keyframe.time,
          property: "scene.camera.fov",
          value: keyframe.value,
          easing: keyframe.easing,
        });
      }
    }
  }
  return keyframes;
}

function mergeSceneKeyframes(
  existing: readonly Keyframe[],
  added: readonly Keyframe[],
): Keyframe[] {
  if (added.length === 0) return [...existing];
  const replaced = new Set(added.map((keyframe) => keyframe.property));
  return [
    ...existing.filter((keyframe) => !replaced.has(keyframe.property)),
    ...added,
  ];
}

function preservedScene3DKeyframes(
  layer: MotionScene3DLayer | undefined,
  validRenderObjectIds: ReadonlySet<string>,
): Keyframe[] {
  if (!layer) return [];
  return layer.keyframes.filter((keyframe) => {
    const match = /^scene\.object\.([^.]+)\./.exec(keyframe.property);
    if (!match) return true;
    return validRenderObjectIds.has(match[1]);
  });
}
