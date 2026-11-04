import { afterEach, describe, expect, it } from "vitest";
import { useSettingsStore } from "./settings-store";

const initial = useSettingsStore.getState();
afterEach(() => {
  useSettingsStore.setState(initial, true);
  localStorage.clear();
});

describe("manual settings persistence", () => {
  it("restores current general preferences", async () => {
    localStorage.setItem("openreel-settings", JSON.stringify({
      version: 0,
      state: { autoSave: false, autoSaveInterval: 9, language: "fi" },
    }));
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState()).toMatchObject({
      autoSave: false, autoSaveInterval: 9, language: "fi",
    });
  });

  it("persists only supported manual preferences, not session AI configuration", () => {
    useSettingsStore.getState().setDefaultLlmProvider("openai-compatible");
    useSettingsStore.getState().openSettings("ai-editor");
    const persisted = JSON.parse(localStorage.getItem("openreel-settings")!);
    expect(persisted.state).toEqual({
      autoSave: initial.autoSave,
      autoSaveInterval: initial.autoSaveInterval,
      language: initial.language,
    });
    expect(useSettingsStore.getState().defaultLlmProvider).toBe("openai-compatible");
  });
});
