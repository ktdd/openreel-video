import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_VIDEO_SETTINGS } from "@openreel/core";
import { useExportRunner, type UseExportRunner } from "../../services/export-runner";
import { createEmptyProject } from "../../stores/project/project-helpers";
import { useProjectStore } from "../../stores/project-store";
import { useUIStore } from "../../stores/ui-store";
import { ExportDialog } from "./ExportDialog";
import { Toolbar } from "./Toolbar";

vi.mock("@openreel/core", async (importOriginal) => ({
  ...await importOriginal<typeof import("@openreel/core")>(),
  getDeviceProfile: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock("../../services/export-runner", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../services/export-runner")>(),
  useExportRunner: vi.fn(),
}));
vi.mock("./ExportDialog", () => ({ ExportDialog: vi.fn(() => null) }));
vi.mock("./CompressDialog", () => ({ CompressDialog: () => null }));
vi.mock("./ProjectSwitcher", () => ({ ProjectSwitcher: () => null }));
vi.mock("./settings/SettingsDialog", () => ({ SettingsDialog: () => null }));
vi.mock("./inspector/HistoryPanel", () => ({ HistoryPanel: () => null }));

let runner: UseExportRunner;
let writable: FileSystemWritableFileStream;

function setDuration(duration: number): void {
  const project = useProjectStore.getState().project;
  useProjectStore.setState({ project: { ...project, timeline: { ...project.timeline, duration } } });
}
function openOptions(): void {
  fireEvent.keyDown(screen.getByRole("button", { name: "Export options" }), { key: "ArrowDown" });
}

beforeEach(() => {
  vi.clearAllMocks();
  useProjectStore.setState({ hasOpenProject: true, project: createEmptyProject("Toolbar export") });
  useUIStore.getState().closeModal();
  setDuration(3);
  writable = {} as FileSystemWritableFileStream;
  runner = {
    state: { isExporting: false, progress: 0, phase: "", error: null, complete: false },
    runExport: vi.fn().mockResolvedValue(undefined),
    runAudioExport: vi.fn().mockResolvedValue(undefined),
    showSavePicker: vi.fn().mockResolvedValue(writable),
    reportProgress: vi.fn(),
    markComplete: vi.fn(),
    beginExport: vi.fn(() => vi.fn()),
    assertNotCancelled: vi.fn(),
    finishExportSoon: vi.fn(),
    failExport: vi.fn(),
    cancel: vi.fn(),
    resetError: vi.fn(),
  };
  vi.mocked(useExportRunner).mockReturnValue(runner);
});
afterEach(() => {
  cleanup();
  useUIStore.getState().closeModal();
  vi.restoreAllMocks();
});

describe("toolbar export controls", () => {
  it("disables both export controls on an empty timeline and cannot open the options menu", () => {
    setDuration(0);
    render(<Toolbar />);
    const exportButton = screen.getByRole("button", { name: "Export" });
    const optionsButton = screen.getByRole("button", { name: "Export options" });
    expect(exportButton).toBeDisabled();
    expect(optionsButton).toBeDisabled();
    fireEvent.click(exportButton);
    openOptions();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(useUIStore.getState().activeModal).not.toBe("export");
    expect(runner.showSavePicker).not.toHaveBeenCalled();
  });

  it("enables exports when content is added", () => {
    setDuration(0);
    render(<Toolbar />);
    act(() => setDuration(3));
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export options" })).toBeEnabled();
    openOptions();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("closes an open menu when the timeline empties and does not reopen it when content returns", () => {
    render(<Toolbar />);
    openOptions();
    expect(screen.getByRole("menu")).toBeInTheDocument();
    act(() => setDuration(0));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export options" })).toBeDisabled();
    act(() => setDuration(3));
    expect(screen.getByRole("button", { name: "Export options" })).toBeEnabled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the export dialog directly from the primary button", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(useUIStore.getState().activeModal).toBe("export");
    expect(vi.mocked(ExportDialog).mock.lastCall?.[0]).toMatchObject({ isOpen: true, duration: 3 });
  });

  it("keeps preset video export delivery working without an analytics callback", async () => {
    render(<Toolbar />);
    openOptions();
    fireEvent.click(screen.getByRole("menuitem", { name: /MP4 Standard/ }));
    await waitFor(() => expect(runner.runExport).toHaveBeenCalledWith(
      expect.objectContaining({ format: "mp4", codec: "h264" }), "mp4", writable,
    ));
    expect(runner.showSavePicker).toHaveBeenCalledWith("Toolbar export.mp4", "mp4", { delivery: "download" });
    expect(runner.finishExportSoon).toHaveBeenCalledOnce();
    expect(runner.failExport).not.toHaveBeenCalled();
    expect(vi.mocked(useExportRunner).mock.lastCall?.[0]).toEqual({ project: useProjectStore.getState().project });
  });

  it("keeps WAV export completion working without event tracking", async () => {
    render(<Toolbar />);
    openOptions();
    fireEvent.click(screen.getByRole("menuitem", { name: /Audio Only \(WAV\)/ }));
    await waitFor(() => expect(runner.runAudioExport).toHaveBeenCalledWith({
      format: "wav", sampleRate: 48000, channels: 2, bitDepth: 24,
    }, writable));
    expect(runner.markComplete).toHaveBeenCalledOnce();
    expect(runner.finishExportSoon).toHaveBeenCalledOnce();
    expect(runner.failExport).not.toHaveBeenCalled();
  });

  it("keeps custom export settings and delivery working without event tracking", async () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    const props = vi.mocked(ExportDialog).mock.lastCall?.[0];
    if (!props) throw new Error("Missing export dialog props");
    await act(async () => { await props.onExport(DEFAULT_VIDEO_SETTINGS, "file"); });
    expect(runner.showSavePicker).toHaveBeenCalledWith("Toolbar export.mp4", "mp4", { delivery: "file" });
    expect(runner.runExport).toHaveBeenCalledWith(expect.objectContaining({
      format: "mp4", codec: "h264", width: DEFAULT_VIDEO_SETTINGS.width,
    }), "mp4", writable);
    expect(runner.finishExportSoon).toHaveBeenCalledOnce();
    expect(runner.failExport).not.toHaveBeenCalled();
    expect(useUIStore.getState().activeModal).toBeNull();
  });
});
