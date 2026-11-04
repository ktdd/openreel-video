import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { projectManager } from "./project-manager";
import { createEmptyProject } from "../stores/project/project-helpers";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  (window as any).openreel = {
    platform: "desktop",
    fs: {
      showSaveDialog: vi.fn(async () => "/tmp/proj.oreel"),
      showOpenDialog: vi.fn(async () => "/tmp/proj.oreel"),
      writeFile: vi.fn(async (p: string, d: string) => {
        store.set(p, d);
      }),
      readFile: vi.fn(async (p: string) => store.get(p) ?? ""),
    },
  };
});

afterEach(() => {
  delete (window as any).openreel;
});

const blank = createEmptyProject("Demo");
const project = { ...blank, id: "p1", timeline: { ...blank.timeline, duration: 1 } };

describe("ProjectManager desktop fs", () => {
  it("saveProjectAs writes via window.openreel.fs and round-trips", async () => {
    const ok = await projectManager.saveProjectAs(project);
    expect(ok).toBe(true);
    expect((window as any).openreel.fs.writeFile).toHaveBeenCalled();
    const loaded = await projectManager.openProject();
    expect(loaded?.name).toBe("Demo");
  });
});
