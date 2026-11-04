import "../../../test/install-local-storage-mock";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectStore } from "../../../stores/project-store";
import { useSettingsStore } from "../../../stores/settings-store";
import { SettingsDialog } from "./SettingsDialog";

const initial = useSettingsStore.getState();
beforeEach(() => {
  useSettingsStore.setState(initial, true);
  useProjectStore.getState().createNewProject("Manual preferences");
  useSettingsStore.getState().openSettings();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useSettingsStore.setState(initial, true);
});

describe("manual-only settings", () => {
  it("keeps composition, background and autosave editing without provider tabs or requests", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const view = render(<SettingsDialog />);
    expect(view.queryAllByRole("tab")).toHaveLength(0);
    expect(view.queryByText(/API Keys|AI Connections|MCP|AI Editor/)).toBeNull();
    expect(view.queryByRole("textbox", { name: /Base URL|Model ID/ })).toBeNull();
    fireEvent.change(view.getByRole("combobox", { name: "Editing frame rate" }), { target: { value: "24" } });
    await waitFor(() => expect(useProjectStore.getState().project.settings.frameRate).toBe(24));
    fireEvent.click(view.getByRole("button", { name: "Background color #2563EB" }));
    expect(useProjectStore.getState().project.timeline.layoutBackgroundColor).toBe("#2563EB");
    fireEvent.click(view.getByRole("switch", { name: "Enable auto-save" }));
    expect(useSettingsStore.getState().autoSave).toBe(false);
    expect(view.queryByRole("combobox", { name: "Auto-save interval" })).toBeNull();
    const stored = JSON.parse(localStorage.getItem("openreel-settings")!);
    expect(stored.state).toEqual({ autoSave: false, autoSaveInterval: 5, language: "en" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
