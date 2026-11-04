import { describe, expect, it } from "vitest";
import legacyProject from "../../../../packages/core/src/test/fixtures/ai-removal/legacy-ai-project.json";
import browserState from "./fixtures/ai-removal-browser-state.json";

// Historical fixture integrity only; old-state hydration is no longer required.
describe("AI removal browser-state fixtures", () => {

  it("covers retired UI/provider settings without real credentials or executable clients", () => {
    expect(browserState.localStorage["openreel-ui-preferences"].state).toMatchObject({
      inspectorActiveTab: "ai", panels: { agentChat: { visible: true, width: 420 } },
    });
    expect(new URL(browserState.localStorage["openreel-settings"].state.llmBaseUrl).hostname).toBe("ai-fixture.invalid");
    expect(browserState.localStorage["openreel-ai-chat-history"].state.conversations[0].projectId).toBe(legacyProject.project.id);
    expect(browserState.localStorage["phase0-unrelated-preference"].keep).toContain("must survive");
    expect(browserState.indexedDB.records.some((record) => record.id === "phase0-unknown-secret")).toBe(true);
    expect(browserState.indexedDB.records.every((record) => record.iv.length === 12)).toBe(true);
  });

  it("pending and failed browser tasks refer to existing project placeholders", () => {
    const tasks = browserState.localStorage["kieai-pending-tasks"].state.tasks;
    expect(tasks.map((task) => task.failed)).toEqual([false, true]);
    for (const task of tasks) {
      const media = legacyProject.project.mediaLibrary.items.find((item) => item.id === task.mediaId);
      expect(task.projectId).toBe(legacyProject.project.id);
      expect(media?.kieaiTaskId).toBe(task.taskId);
      expect(media?.isPlaceholder).toBe(true);
      expect(legacyProject.project.timeline.tracks.flatMap((track) => track.clips).some((clip) => clip.mediaId === task.mediaId)).toBe(true);
    }
  });
});
