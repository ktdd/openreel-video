import type { Project, ProjectSettings } from "@openreel/core";
import { normalizeProjectStoredFields } from "@openreel/core";
import { v4 as uuidv4 } from "uuid";

interface FilePickerAcceptType {
  description: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
}

interface OpenFilePickerOptions {
  types?: FilePickerAcceptType[];
  multiple?: boolean;
}

interface WindowWithFilePicker extends Window {
  showSaveFilePicker?: (
    options?: SaveFilePickerOptions,
  ) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (
    options?: OpenFilePickerOptions,
  ) => Promise<FileSystemFileHandle[]>;
}

interface FileHandleWithPermissions extends FileSystemFileHandle {
  queryPermission?: (options: { mode: string }) => Promise<string>;
  requestPermission?: (options: { mode: string }) => Promise<string>;
}

const PROJECT_DB_NAME = "openreel-projects";
const PROJECT_DB_VERSION = 1;
const PROJECTS_STORE = "projects";
const RECENT_STORE = "recent";
const MAX_RECENT_PROJECTS = 10;

export interface RecentProject {
  id: string;
  name: string;
  lastOpened: number;
  thumbnail?: string;
  fileHandle?: FileSystemFileHandle;
  duration?: number;
  trackCount?: number;
}

type ProjectManagerEvent = "recentUpdated" | "projectSaved" | "projectOpened";
type EventCallback = (data?: unknown) => void;

class ProjectManager {
  private db: IDBDatabase | null = null;
  private listeners: Map<ProjectManagerEvent, Set<EventCallback>> = new Map();
  private currentFileHandle: FileSystemFileHandle | null = null;

  private parseProjectContent(content: string): Project {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("Project file is empty");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      throw new Error(
        `Invalid project file: ${error instanceof Error ? error.message : "Parse error"}`,
      );
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid project file: expected a JSON object");
    }

    const candidate = parsed as Record<string, unknown>;
    const isWrapped =
      typeof candidate.version === "string" &&
      typeof candidate.project === "object" &&
      candidate.project !== null;

    const rawProject = (isWrapped ? candidate.project : parsed) as Project;
    if (typeof rawProject.id !== "string" || typeof rawProject.name !== "string") {
      throw new Error("Invalid project file: missing project id or name");
    }

    return normalizeProjectStoredFields(rawProject);
  }

  async initialize(): Promise<void> {
    this.db = await this.openDatabase();
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB not supported"));
        return;
      }

      const request = indexedDB.open(PROJECT_DB_NAME, PROJECT_DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message}`));
      };

      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          db.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
        }

        if (!db.objectStoreNames.contains(RECENT_STORE)) {
          const store = db.createObjectStore(RECENT_STORE, { keyPath: "id" });
          store.createIndex("lastOpened", "lastOpened", { unique: false });
        }
      };
    });
  }

  async createProject(
    options: {
      name?: string;
      settings?: Partial<ProjectSettings>;
    } = {},
  ): Promise<Project> {
    const settings: ProjectSettings = {
      width: 1920,
      height: 1080,
      frameRate: 30,
      sampleRate: 48000,
      channels: 2,
      ...options.settings,
    };

    const project: Project = {
      id: uuidv4(),
      name: options.name || "Untitled Project",
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      settings,
      timeline: {
        duration: 0,
        tracks: [],
        markers: [],
        subtitles: [],
      },
      mediaLibrary: {
        items: [],
      },
    };

    this.currentFileHandle = null;
    this.emit("projectOpened", { project });
    return project;
  }

  async saveProject(project: Project): Promise<boolean> {
    if (this.currentFileHandle) {
      return this.saveToFileHandle(project, this.currentFileHandle);
    }
    return this.saveProjectAs(project);
  }

  async saveProjectAs(project: Project): Promise<boolean> {
    if (!("showSaveFilePicker" in window)) {
      return this.downloadProject(project);
    }

    let handle: FileSystemFileHandle;
    try {
      const win = window as WindowWithFilePicker;
      handle = await win.showSaveFilePicker!({
        suggestedName: `${project.name}.oreel`,
        types: [
          {
            description: "OpenReel Project",
            accept: { "application/json": [".oreel", ".json"] },
          },
        ],
      });
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return false;
      }
      console.warn(
        "[ProjectManager] showSaveFilePicker unavailable; falling back to download",
        error,
      );
      return this.downloadProject(project);
    }

    // Picker cancellation returns false. A selected file that fails to write
    // must reject so callers can distinguish failure and report it to the user.
    await this.saveToFileHandle(project, handle);
    this.currentFileHandle = handle;
    await this.addToRecent(project, handle);
    return true;
  }

  private async saveToFileHandle(
    project: Project,
    handle: FileSystemFileHandle,
  ): Promise<boolean> {
    const data = JSON.stringify(project, null, 2);
    const writable = await handle.createWritable();
    try {
      await writable.write(data);
      await writable.close();
    } catch (error) {
      // Release the stream/lock and discard partial data when writing fails.
      await writable.abort().catch(() => {});
      throw error;
    }

    this.emit("projectSaved", { project });
    return true;
  }

  private downloadProject(project: Project): boolean {
    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name}.oreel`;
    try {
      document.body.appendChild(a);
      a.click();
    } finally {
      a.remove();
      URL.revokeObjectURL(url);
    }

    this.emit("projectSaved", { project });
    return true;
  }

  async openProject(): Promise<Project | null> {
    if ("showOpenFilePicker" in window) {
      try {
        const win = window as WindowWithFilePicker;
        const [handle] = await win.showOpenFilePicker!({
          types: [
            {
              description: "OpenReel Project",
              accept: { "application/json": [".oreel", ".json"] },
            },
          ],
          multiple: false,
        });

        const file = await handle.getFile();
        const content = await file.text();
        const project = this.parseProjectContent(content);

        this.currentFileHandle = handle;
        await this.addToRecent(project, handle);
        this.emit("projectOpened", { project });

        return project;
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          return null;
        }
        console.error("[ProjectManager] Open failed:", error);
        return null;
      }
    }

    return this.openProjectViaInput();
  }

  private openProjectViaInput(): Promise<Project | null> {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".oreel,.json";

      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        try {
          const content = await file.text();
          const project = this.parseProjectContent(content);
          await this.addToRecent(project);
          this.emit("projectOpened", { project });
          resolve(project);
        } catch (error) {
          console.error("[ProjectManager] Parse failed:", error);
          resolve(null);
        }
      };

      input.click();
    });
  }

  async openRecentProject(
    recentProject: RecentProject,
  ): Promise<Project | null> {
    if (recentProject.fileHandle) {
      try {
        const handle = recentProject.fileHandle as FileHandleWithPermissions;
        const permission = await handle.queryPermission?.({ mode: "read" });
        if (permission !== "granted") {
          const request = await handle.requestPermission?.({ mode: "read" });
          if (request !== "granted") {
            return null;
          }
        }

        const file = await handle.getFile();
        const content = await file.text();
        const project = this.parseProjectContent(content);

        this.currentFileHandle = handle;
        await this.updateRecentTimestamp(recentProject.id);
        this.emit("projectOpened", { project });

        return project;
      } catch (error) {
        console.error("[ProjectManager] Open recent failed:", error);
        await this.removeFromRecent(recentProject.id);
        return null;
      }
    }

    return this.loadProjectFromDb(recentProject.id);
  }

  private async loadProjectFromDb(id: string): Promise<Project | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(PROJECTS_STORE, "readonly");
      const store = tx.objectStore(PROJECTS_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const project = request.result as Project | undefined;
        if (project) {
          this.emit("projectOpened", { project });
        }
        resolve(project || null);
      };

      request.onerror = () => resolve(null);
    });
  }

  async getRecentProjects(): Promise<RecentProject[]> {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve) => {
      if (!this.db) {
        resolve([]);
        return;
      }

      const tx = this.db.transaction(RECENT_STORE, "readonly");
      const store = tx.objectStore(RECENT_STORE);
      const index = store.index("lastOpened");
      const request = index.getAll();

      request.onsuccess = () => {
        const items = (request.result as RecentProject[])
          .sort((a, b) => b.lastOpened - a.lastOpened)
          .slice(0, MAX_RECENT_PROJECTS);
        resolve(items);
      };

      request.onerror = () => resolve([]);
    });
  }

  async addToRecent(
    project: Project,
    fileHandle?: FileSystemFileHandle,
  ): Promise<void> {
    if (!this.db) return;

    const recentProject: RecentProject = {
      id: project.id,
      name: project.name,
      lastOpened: Date.now(),
      fileHandle,
      duration: project.timeline.duration,
      trackCount: project.timeline.tracks.length,
    };

    return new Promise((resolve) => {
      const tx = this.db!.transaction(RECENT_STORE, "readwrite");
      const store = tx.objectStore(RECENT_STORE);
      store.put(recentProject);

      tx.oncomplete = () => {
        this.emit("recentUpdated");
        this.cleanupOldRecent();
        resolve();
      };

      tx.onerror = () => resolve();
    });
  }

  private async updateRecentTimestamp(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(RECENT_STORE, "readwrite");
      const store = tx.objectStore(RECENT_STORE);
      const request = store.get(id);

      request.onsuccess = () => {
        const recent = request.result as RecentProject | undefined;
        if (recent) {
          recent.lastOpened = Date.now();
          store.put(recent);
        }
        resolve();
      };

      request.onerror = () => resolve();
    });
  }

  async removeFromRecent(id: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(RECENT_STORE, "readwrite");
      const store = tx.objectStore(RECENT_STORE);
      store.delete(id);

      tx.oncomplete = () => {
        this.emit("recentUpdated");
        resolve();
      };

      tx.onerror = () => resolve();
    });
  }

  private async cleanupOldRecent(): Promise<void> {
    const recent = await this.getRecentProjects();
    if (recent.length > MAX_RECENT_PROJECTS) {
      const toRemove = recent.slice(MAX_RECENT_PROJECTS);
      for (const item of toRemove) {
        await this.removeFromRecent(item.id);
      }
    }
  }

  async clearRecentProjects(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const tx = this.db!.transaction(RECENT_STORE, "readwrite");
      const store = tx.objectStore(RECENT_STORE);
      store.clear();

      tx.oncomplete = () => {
        this.emit("recentUpdated");
        resolve();
      };

      tx.onerror = () => resolve();
    });
  }

  getCurrentFileHandle(): FileSystemFileHandle | null {
    return this.currentFileHandle;
  }

  /** Imported independent copies must not overwrite a previously opened file. */
  releaseCurrentFileHandle(): void {
    this.currentFileHandle = null;
  }

  hasUnsavedChanges(project: Project): boolean {
    const projectWithSavedAt = project as Project & { lastSavedAt?: number };
    return (
      !this.currentFileHandle ||
      project.modifiedAt > (projectWithSavedAt.lastSavedAt ?? 0)
    );
  }

  on(event: ProjectManagerEvent, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  private emit(event: ProjectManagerEvent, data?: unknown): void {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(data);
      } catch (error) {
        console.error("[ProjectManager] Event callback error:", error);
      }
    });
  }
}

export const projectManager = new ProjectManager();

export async function initializeProjectManager(): Promise<void> {
  await projectManager.initialize();
}
