import "../../test/install-local-storage-mock";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MediaItem } from "@openreel/core";
import { AssetsPanel } from "./AssetsPanel";
import { EditorActionRail } from "./EditorActionRail";
import { SettingsDialog } from "./settings/SettingsDialog";
import { useProjectStore } from "../../stores/project-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useUIStore } from "../../stores/ui-store";

vi.mock("./inspector/MusicLibraryPanel", () => ({ MusicLibraryPanel: () => <p>Music and sound library</p> }));
vi.mock("./inspector/FilterPresetsPanel", () => ({ FilterPresetsPanel: () => <p>Manual filter presets</p> }));
vi.mock("./settings/GeneralPanel", () => ({ GeneralPanel: () => <p>Project and general settings</p> }));

const settings = useSettingsStore.getState();
beforeEach(() => {
  useProjectStore.getState().createNewProject("Manual edit");
  useUIStore.getState().clearSelection();
  useSettingsStore.setState({ settingsOpen: false });
});
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  useSettingsStore.setState(settings, true);
});

function image(id: string, missing = false): MediaItem {
  return { id, name: `${id}.png`, type: "image", fileHandle: null,
    blob: missing ? null : new Blob(["completed image"], { type: "image/png" }),
    thumbnailUrl: "data:image/png;base64,cG5n", waveformData: null, isPlaceholder: missing,
    metadata: { duration: 0, width: 640, height: 360, frameRate: 0, codec: "png", sampleRate: 0, channels: 0, fileSize: 15 },
  };
}

describe("Phase 2 chat and Kie surface removal", () => {
  it("keeps music, filters, titles and Recipes accessible without generation tools", () => {
    const request = vi.spyOn(globalThis, "fetch");
    const view = render(<AssetsPanel />);
    expect(view.queryByRole("button", { name: "AI Generate" })).toBeNull();
    expect(view.getByRole("button", { name: "Recipes" })).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Audio" }));
    expect(view.getByText("Music and sound library")).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Effects" }));
    fireEvent.click(view.getByRole("button", { name: "Filter Presets" }));
    expect(view.getByText("Manual filter presets")).toBeInTheDocument();
    fireEvent.click(view.getByRole("button", { name: "Text" }));
    expect(view.getByRole("button", { name: "Add Title" })).toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Text to Speech" })).toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps completed generated images as ordinary editable media and missing-media relinking intact", async () => {
    const completed = image("completed-generated");
    const missing = image("missing-source", true);
    const project = useProjectStore.getState().project;
    useProjectStore.getState().loadProject({ ...project, mediaLibrary: { items: [completed, missing] } });
    const request = vi.spyOn(globalThis, "fetch");
    const view = render(<AssetsPanel />);
    fireEvent.mouseEnter(view.getByAltText(completed.name).parentElement!);
    expect(view.queryByRole("button", { name: /KieAI|Retry generation/i })).toBeNull();
    fireEvent.click(view.getByRole("button", { name: "Add to timeline" }));
    await waitFor(() => expect(useProjectStore.getState().project.timeline.tracks.flatMap((track) => track.clips)).toHaveLength(1));
    const clip = useProjectStore.getState().project.timeline.tracks.flatMap((track) => track.clips)[0];
    expect(clip.mediaId).toBe(completed.id);
    expect(useProjectStore.getState().project.mediaLibrary.items[0].blob).toBe(completed.blob);
    fireEvent.mouseLeave(view.getByAltText(completed.name).parentElement!);
    fireEvent.mouseEnter(view.getByAltText(missing.name).parentElement!);
    const picker = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    fireEvent.click(view.getByRole("button", { name: "Replace asset" }));
    expect(picker).toHaveBeenCalledOnce();
    expect(view.getByRole("button", { name: "Relink from Folder" })).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it("removes chat actions and provider settings while keeping manual navigation", () => {
    const rail = render(<EditorActionRail />);
    expect(rail.queryByRole("button", { name: /AI Editor|ask AI/i })).toBeNull();
    expect(rail.getByRole("button", { name: "Search tools and effects" })).toBeInTheDocument();
    fireEvent.click(rail.getByRole("button", { name: "Audio mixer" }));
    expect(useUIStore.getState().panels.audioMixer.visible).toBe(true);
    rail.unmount();
    useSettingsStore.getState().openSettings();
    const view = render(<SettingsDialog />);
    expect(view.queryAllByRole("tab")).toHaveLength(0);
    expect(view.queryByText("API Keys")).toBeNull();
    expect(view.getByText("Project and general settings")).toBeInTheDocument();
  });
});
