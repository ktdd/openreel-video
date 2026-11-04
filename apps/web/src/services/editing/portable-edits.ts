import { parseEditPreset, materializePortableEdit, type EditPreset, type PortableEdit } from "@openreel/core/editing/portable-project";
import { EditingSession } from "./editing-session";
import { runExclusive } from "./mutation-queue";
import { addEditingTransition } from "./transition-tools";

export function runLocalEdit<T>(label: string, edit: (session: EditingSession) => Promise<T> | T): Promise<T> {
  return runExclusive(async () => {
    const session = new EditingSession();
    const transaction = session.beginTransaction();
    try {
      const result = await edit(session);
      await session.commitTransaction(transaction, label);
      return result;
    } catch (error) {
      await session.rollbackTransaction();
      throw error;
    }
  });
}

export function importPortableEdit(document: PortableEdit) {
  return runLocalEdit("Import portable edit", (session) => {
    const restored = materializePortableEdit(document, session.getProject());
    session.replaceDraft(restored.project);
    return restored;
  });
}

/** Validated local actions only. Nothing is published until all effects/transition succeed. */
export function applySharedPreset(clipId: string, value: EditPreset): Promise<string> {
  const preset = parseEditPreset(JSON.stringify(value));
  return runLocalEdit("Apply shared preset", async (session) => {
    const track = session.getProject().timeline.tracks.find((candidate) => candidate.clips.some((clip) => clip.id === clipId));
    if (!track) throw new Error("Choose a media clip first");
    if (track.locked) throw new Error("The target track is locked");
    const ordered = [...track.clips].sort((a, b) => a.startTime - b.startTime);
    const next = ordered[ordered.findIndex((clip) => clip.id === clipId) + 1];
    for (const effect of preset.effects) {
      const result = await session.applyAction({
        type: "effect/add", id: crypto.randomUUID(), timestamp: Date.now(),
        params: { clipId, effectType: effect.type, effectId: crypto.randomUUID(), params: effect.params, enabled: effect.enabled },
      });
      if (!result.success) throw new Error(result.error?.message ?? "Could not apply effect");
      if (!effect.enabled) {
        const added = session.getProject().timeline.tracks.find((candidate) => candidate.id === track.id)?.clips.find((clip) => clip.id === clipId)?.effects.at(-1);
        const toggled = await session.applyAction({ type: "effect/toggle", id: crypto.randomUUID(), timestamp: Date.now(), params: { clipId, effectId: added?.id, enabled: false } });
        if (!toggled.success) throw new Error(toggled.error?.message ?? "Could not disable effect");
      }
    }
    if (preset.transition) {
      if (!next) throw new Error("A transition preset needs an adjacent next clip");
      const result = await addEditingTransition({ clipAId: clipId, clipBId: next.id, transitionType: preset.transition.type, duration: preset.transition.duration, params: preset.transition.params }, session);
      if (!result.ok) throw new Error(result.error?.message ?? result.summary);
    }
    return `Applied preset ${preset.name}`;
  });
}

export function relinkSharedMedia(mediaId: string, file: File): Promise<void> {
  return runLocalEdit("Relink shared media", (session) => session.relinkMedia(mediaId, file));
}
