import { ActionExecutor } from "@openreel/core";
import { editSnapshot, type EditSnapshot } from "@openreel/core/actions/handlers/edit-snapshot";
import { createPortableEdit } from "@openreel/core/editing/portable-project";
import { TitleEngine } from "@openreel/core/text/title-engine";
import type { Project, Action } from "@openreel/core";

export interface TxnHandle { readonly id: string }
export interface TextOverlayOptions {
  readonly text: string;
  readonly startSec: number;
  readonly durationSec: number;
  readonly trackId?: string;
  readonly style?: Record<string, unknown>;
}
export interface UpdateTextOverlayOptions {
  readonly text?: string;
  readonly style?: Record<string, unknown>;
  readonly transform?: Record<string, unknown>;
}
import { useProjectStore } from "../../stores/project-store";
import { useUIStore } from "../../stores/ui-store";
import { getMediaBridge, initializeMediaBridge } from "../../bridges/media-bridge";

export function cloneEditSnapshot(snapshot: EditSnapshot): EditSnapshot {
  return { ...JSON.parse(JSON.stringify({ ...snapshot, mediaLibrary: undefined })), mediaLibrary: { items: snapshot.mediaLibrary.items.map((m) => ({ ...m })) } } as EditSnapshot;
}
const resourceRevisions = new WeakMap<object, number>();
let nextResourceRevision = 0;
function resourceRevision(value: object | null | undefined): number {
  if (!value) return 0;
  if (!resourceRevisions.has(value)) resourceRevisions.set(value, ++nextResourceRevision);
  return resourceRevisions.get(value)!;
}
export function projectRevision(project: Project): string {
  return JSON.stringify({ ...editSnapshot(project), mediaLibrary: { items: project.mediaLibrary.items.map((m) => ({
    ...m, blob: resourceRevision(m.blob), fileHandle: resourceRevision(m.fileHandle),
    waveformData: resourceRevision(m.waveformData), filmstripThumbnails: resourceRevision(m.filmstripThumbnails),
  })) }, id: project.id, modifiedAt: project.modifiedAt });
}

/** Engine actions run on an isolated draft. Exactly one snapshot enters UI history. */
export class EditingSession {
  private draft!: Project;
  private revision = "";
  private original!: Project;
  private executor = new ActionExecutor();
  private hasChanges = false;
  private exportRequested = false;
  private portable = false;
  committed = false;
  constructor(private signal?: AbortSignal) {}
  requireOpenProject(): void { if (!useProjectStore.getState().hasOpenProject) throw new Error("Open a project first"); }
  getProject(): Project { this.requireOpenProject(); return this.draft; }
  beginTransaction(): TxnHandle {
    this.requireOpenProject();
    this.hasChanges = false;
    this.exportRequested = false;
    this.committed = false;
    this.original = useProjectStore.getState().getFullProject();
    this.revision = projectRevision(this.original);
    this.draft = { ...this.original, ...cloneEditSnapshot(editSnapshot(this.original)) };
    try { createPortableEdit(this.draft); this.portable = true; } catch { this.portable = false; }
    return { id: crypto.randomUUID() };
  }
  async applyAction(action: Action) {
    if (this.signal?.aborted) throw new Error("Edit cancelled");
    const result = await this.executor.execute(action, this.draft);
    if (result.success) {
      if (this.portable) createPortableEdit(this.draft);
      this.hasChanges = true;
    }
    return result;
  }
  async commitTransaction(_handle: TxnHandle, label: string): Promise<void> {
    if (this.signal?.aborted) throw new Error("Edit cancelled");
    if (projectRevision(useProjectStore.getState().getFullProject()) !== this.revision) throw new Error("The project changed while the edit was being prepared. No changes were applied; try again.");
    if (this.hasChanges) {
      const store = useProjectStore.getState();
      store.beginHistoryGroup(label);
      try {
        const result = await store.executeAction({ type: "project/applyEditSnapshot", id: crypto.randomUUID(), timestamp: Date.now(), params: { snapshot: cloneEditSnapshot(editSnapshot(this.draft)) } });
        if (!result.success) throw new Error(result.error?.message ?? "Could not apply edit");
        this.committed = true;
      } finally { store.endHistoryGroup(); }
    }
    if (this.exportRequested) useUIStore.getState().openModal("export");
  }
  async rollbackTransaction(): Promise<void> { this.hasChanges = false; this.exportRequested = false; }
  requestExport(): void { this.exportRequested = true; }
  replaceDraft(project: Project): void { this.draft = project; this.hasChanges = true; }
  async relinkMedia(mediaId: string, file: File): Promise<void> {
    const old = this.draft.mediaLibrary.items.find((m) => m.id === mediaId);
    if (!old) throw new Error("Missing media reference");
    if (!getMediaBridge().isInitialized()) await initializeMediaBridge();
    const result = await getMediaBridge().importFile(file, true);
    if (!result.success || !result.media) throw new Error(result.error ?? "Could not decode media");
    const decoded = result.media;
    const type = decoded.metadata.hasVideo ? "video" : decoded.metadata.hasAudio ? "audio" : "image";
    if (type !== old.type) throw new Error("Choose the same decoded media type");
    const asset = { ...old, name: file.name, blob: file, fileHandle: null, isPlaceholder: false, sourceFile: { name: file.name, size: file.size, lastModified: file.lastModified }, metadata: { duration: decoded.metadata.duration ?? 0, width: decoded.metadata.width ?? 0, height: decoded.metadata.height ?? 0, frameRate: decoded.metadata.frameRate ?? 0, codec: decoded.metadata.codec ?? "", sampleRate: decoded.metadata.sampleRate ?? 0, channels: decoded.metadata.channels ?? 0, fileSize: file.size }, thumbnailUrl: decoded.thumbnails?.[0]?.dataUrl ?? null, waveformData: decoded.waveformData?.peaks ?? null };
    const project = { ...this.draft, mediaLibrary: { items: this.draft.mediaLibrary.items.map((m) => m.id === mediaId ? asset : m) } };
    createPortableEdit(project); // Check actual decoded source ranges before publishing.
    this.replaceDraft(project);
  }
  async createTextOverlay(options: TextOverlayOptions) {
    let trackId = options.trackId ?? this.draft.timeline.tracks.find((t) => t.type === "text")?.id;
    if (!trackId) {
      const result = await this.applyAction({ type: "track/add", id: crypto.randomUUID(), timestamp: Date.now(), params: { trackType: "text", position: 0 } });
      if (!result.success) throw new Error(result.error?.message);
      trackId = this.draft.timeline.tracks.find((t) => t.type === "text")!.id;
    }
    if (this.draft.timeline.tracks.find((t) => t.id === trackId)?.locked) throw new Error("Text track is locked");
    const clip = new TitleEngine().createTextClip({ trackId, text: options.text, startTime: options.startSec, duration: options.durationSec, style: options.style });
    const result = await this.applyAction({ type: "text/create", id: crypto.randomUUID(), timestamp: Date.now(), params: { clip } });
    if (!result.success) throw new Error(result.error?.message);
    return { id: clip.id, trackId };
  }
  async updateTextOverlay(id: string, options: UpdateTextOverlayOptions) {
    const clip = this.draft.textClips?.find((c) => c.id === id);
    if (!clip) throw new Error(`Text element not found: ${id}`);
    if (this.draft.timeline.tracks.find((t) => t.id === clip.trackId)?.locked) throw new Error("Text track is locked");
    const updates = { ...(options.text !== undefined ? { text: options.text } : {}), ...(options.style ? { style: { ...clip.style, ...options.style } } : {}), ...(options.transform ? { transform: { ...clip.transform, ...options.transform } } : {}) };
    const result = await this.applyAction({ type: "text/update", id: crypto.randomUUID(), timestamp: Date.now(), params: { clipId: id, updates } });
    if (!result.success) throw new Error(result.error?.message);
    return { id, trackId: clip.trackId };
  }
}
