import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_AUDIO_SETTINGS, DEFAULT_TEXT_STYLE, DEFAULT_VIDEO_SETTINGS, type AudioExportSettings, type Clip, type MediaItem, type Track } from "@openreel/core";
import { useExportRunner, type UseExportRunner } from "../../services/export-runner";
import { createEmptyProject } from "../../stores/project/project-helpers";
import { useProjectStore } from "../../stores/project-store";
import { useUIStore } from "../../stores/ui-store";
import { useTimelineStore } from "../../stores/timeline-store";
import { ExportDialog } from "./ExportDialog";
import { ExportAudioDialog } from "./ExportAudioDialog";
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
vi.mock("./ExportAudioDialog", () => ({ ExportAudioDialog: vi.fn(() => null) }));
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
function setContent(kind: "video" | "image" | "audio", trackType: Track["type"] = "video"): void {
  const project = useProjectStore.getState().project;
  const clip: Clip = {
    id: "clip", mediaId: "media", trackId: "track", startTime: 0, duration: 3, inPoint: 0, outPoint: 3,
    effects: [], audioEffects: [], volume: 1, keyframes: [],
    transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, anchor: { x: 0.5, y: 0.5 }, opacity: 1 },
  };
  const media: MediaItem = {
    id: "media", name: `Source.${kind}`, type: kind, fileHandle: null, blob: new Blob(["original"]),
    thumbnailUrl: null, waveformData: null,
    metadata: { duration: 3, width: kind === "audio" ? 0 : 1920, height: kind === "audio" ? 0 : 1080,
      frameRate: 30, codec: kind === "audio" ? "pcm" : "h264", fileSize: 8,
      sampleRate: kind === "image" ? 0 : 48000, channels: kind === "image" ? 0 : 2,
      hasVideo: kind === "video", hasAudio: kind !== "image" },
  };
  const track: Track = { id: "track", name: "Track", type: trackType, clips: [clip], transitions: [],
    hidden: false, muted: false, locked: false, solo: false };
  useProjectStore.setState({ project: { ...project, mediaLibrary: { items: [media] },
    timeline: { ...project.timeline, tracks: [track], duration: 3 }, textClips: [] } });
}

function openOptions(): void {
  fireEvent.keyDown(screen.getByRole("button", { name: "Export options" }), { key: "ArrowDown" });
}

beforeEach(() => {
  vi.clearAllMocks();
  useProjectStore.setState({ hasOpenProject: true, project: createEmptyProject("Toolbar export") });
  useUIStore.getState().closeModal();
  useTimelineStore.setState({ loopStart: 0, loopEnd: 0 });
  setContent("video");
  writable = {} as FileSystemWritableFileStream;
  runner = {
    state: { mediaType: "video", isExporting: false, progress: 0, phase: "", error: null, complete: false },
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
    expect(runner.beginExport).toHaveBeenCalledWith(writable, "audio");
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

describe("toolbar audio-only export routing", () => {
  it("opens only audio settings despite an empty video track and a video-typed audio track", () => {
    setContent("audio");
    const project = useProjectStore.getState().project;
    useProjectStore.setState({ project: { ...project, timeline: { ...project.timeline, tracks: [
      { ...project.timeline.tracks[0], id: "empty-video", clips: [] }, ...project.timeline.tracks,
    ] } } });
    useTimelineStore.setState({ loopStart: 1, loopEnd: 2 });
    render(<Toolbar />);
    expect(screen.getByRole("button", { name: "Export" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Export options" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(vi.mocked(ExportDialog)).not.toHaveBeenCalled();
    expect(vi.mocked(ExportAudioDialog).mock.lastCall?.[0]).toMatchObject({
      isOpen: true, duration: 3, hasAudio: true, markedRange: { startTime: 1, endTime: 2 },
    });
  });

  it.each(["video", "image", "text"] as const)("keeps video export for visual %s content on a standard audio-typed track", (kind) => {
    setContent(kind === "text" ? "audio" : kind, "audio");
    if (kind === "text") {
      const project = useProjectStore.getState().project;
      useProjectStore.setState({ project: { ...project, textClips: [{
        id: "title", trackId: "track", startTime: 0, duration: 3, text: "Title",
        style: DEFAULT_TEXT_STYLE, transform: project.timeline.tracks[0].clips[0].transform, keyframes: [],
      }] } });
    }
    render(<Toolbar />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(vi.mocked(ExportDialog).mock.lastCall?.[0]).toMatchObject({ isOpen: true });
    expect(vi.mocked(ExportAudioDialog)).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Export options" })).toBeEnabled();
  });

  it("keeps a genuinely empty project disabled and reports all-muted audio to the dialog", () => {
    useProjectStore.setState({ project: createEmptyProject("Empty") });
    render(<Toolbar />);
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    act(() => {
      setContent("audio");
      const project = useProjectStore.getState().project;
      useProjectStore.setState({ project: { ...project, timeline: { ...project.timeline,
        tracks: project.timeline.tracks.map((track) => ({ ...track, muted: true })),
      } } });
    });
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(vi.mocked(ExportAudioDialog).mock.lastCall?.[0]).toMatchObject({ isOpen: true, hasAudio: false });
  });

  it("switches the open dialog when the project changes between visual and audio-only content", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(vi.mocked(ExportDialog).mock.lastCall?.[0]).toMatchObject({ isOpen: true });
    act(() => setContent("audio"));
    expect(vi.mocked(ExportAudioDialog).mock.lastCall?.[0]).toMatchObject({ isOpen: true });
    act(() => setContent("video"));
    expect(vi.mocked(ExportDialog).mock.lastCall?.[0]).toMatchObject({ isOpen: true });
  });

  it.each((["wav", "mp3", "aac", "ogg", "opus"] as const).flatMap((format) =>
    (["download", "file"] as const).map((delivery) => ({ format, delivery })),
  ))("delivers $format through $delivery with unchanged audio settings", async ({ format, delivery }) => {
    setContent("audio");
    render(<Toolbar />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    const props = vi.mocked(ExportAudioDialog).mock.lastCall?.[0];
    if (!props) throw new Error("Missing audio export dialog props");
    const settings: AudioExportSettings = { ...DEFAULT_AUDIO_SETTINGS, format, bitrate: 128, channels: 1, range: { startTime: 1, endTime: 2 } };
    await act(async () => { await props.onExport(settings, delivery); });
    expect(runner.showSavePicker).toHaveBeenCalledWith(`Toolbar export.${format}`, format, { delivery });
    expect(runner.beginExport).toHaveBeenCalledWith(writable, "audio");
    expect(runner.runAudioExport).toHaveBeenCalledWith(settings, writable);
    expect(runner.runExport).not.toHaveBeenCalled();
    expect(runner.markComplete).toHaveBeenCalledOnce();
    expect(runner.finishExportSoon).toHaveBeenCalledOnce();
    expect(runner.failExport).not.toHaveBeenCalled();
    expect(useUIStore.getState().activeModal).toBeNull();
  });

  it("reports audio encoder failures without marking the export complete", async () => {
    setContent("audio");
    const error = new Error("Audio encoder unavailable");
    vi.mocked(runner.runAudioExport).mockRejectedValueOnce(error);
    render(<Toolbar />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    const props = vi.mocked(ExportAudioDialog).mock.lastCall?.[0];
    if (!props) throw new Error("Missing audio export dialog props");
    await act(async () => { await props.onExport(DEFAULT_AUDIO_SETTINGS); });
    expect(runner.failExport).toHaveBeenCalledWith(error);
    expect(runner.markComplete).not.toHaveBeenCalled();
    expect(runner.finishExportSoon).not.toHaveBeenCalled();
  });

  it.each(["audio", "video"] as const)("publishes the actual %s job type to the preview state", (mediaType) => {
    setContent(mediaType === "audio" ? "video" : "audio");
    runner.state = { ...runner.state, mediaType, isExporting: true, progress: 42, phase: "encoding..." };
    render(<Toolbar />);
    expect(useUIStore.getState().exportState).toEqual({ mediaType, isExporting: true, progress: 42, phase: "encoding..." });
  });
});
