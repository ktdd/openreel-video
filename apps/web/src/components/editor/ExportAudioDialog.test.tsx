import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportAudioDialog } from "./ExportAudioDialog";

type Props = ComponentProps<typeof ExportAudioDialog>;

function setup(overrides: Partial<Props> = {}) {
  const onExport = vi.fn();
  const onClose = vi.fn();
  const props: Props = { isOpen: true, duration: 10, hasAudio: true, onExport, onClose, ...overrides };
  return { ...render(<ExportAudioDialog {...props} />), props, onExport, onClose };
}

function select(label: string, value: string) {
  fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value } });
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("ExportAudioDialog", () => {
  it("offers only custom audio settings and the five requested formats", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Export Audio" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Custom Settings" })).toBeInTheDocument();
    expect(screen.queryByText("Presets")).not.toBeInTheDocument();
    expect(screen.queryByText("Smaller File")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export Video" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /codec|resolution|frame rate/i })).not.toBeInTheDocument();
    const formats = within(screen.getByRole("combobox", { name: "Format" })).getAllByRole("option");
    expect(formats.map((option) => (option as HTMLOptionElement).value)).toEqual(["wav", "mp3", "aac", "ogg", "opus"]);
    expect(formats.map((option) => option.textContent)).toEqual([
      "WAV — Uncompressed", "MP3", "AAC — ADTS", "Ogg — Vorbis", "Opus — Ogg container",
    ]);
  });

  it.each([16, 24, 32])("exports %i-bit WAV with the selected sample rate and channel count", (bitDepth) => {
    const { onExport, onClose } = setup();
    expect(screen.queryByRole("combobox", { name: "Bitrate" })).not.toBeInTheDocument();
    select("Bit depth", String(bitDepth));
    select("Sample rate", "96000");
    select("Channels", "1");
    fireEvent.click(screen.getByRole("button", { name: "Export Audio" }));
    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledWith({
      format: "wav", sampleRate: 96000, channels: 1, bitDepth, bitrate: 192, range: undefined,
    }, "download");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each(["mp3", "aac", "ogg", "opus"])("exports %s with audio bitrate settings and no video settings", (format) => {
    const { onExport } = setup();
    select("Format", format);
    expect(screen.queryByRole("combobox", { name: "Bit depth" })).not.toBeInTheDocument();
    select("Bitrate", "128");
    select("Channels", "1");
    fireEvent.click(screen.getByRole("button", { name: "Export Audio" }));
    expect(onExport).toHaveBeenCalledOnce();
    expect(onExport).toHaveBeenCalledWith({
      format, sampleRate: 48000, channels: 1, bitDepth: 24, bitrate: 128, range: undefined,
    }, "download");
    expect(onExport.mock.calls[0][0]).not.toHaveProperty("width");
    expect(onExport.mock.calls[0][0]).not.toHaveProperty("frameRate");
    expect(onExport.mock.calls[0][0]).not.toHaveProperty("audioSettings");
  });

  it("normalizes incompatible sample rates and bitrates when switching formats", () => {
    setup();
    select("Sample rate", "96000");
    select("Format", "mp3");
    expect(screen.getByRole("combobox", { name: "Sample rate" })).toHaveValue("48000");
    expect(within(screen.getByRole("combobox", { name: "Sample rate" })).queryByRole("option", { name: "96 kHz" })).not.toBeInTheDocument();
    select("Sample rate", "44100");
    select("Bitrate", "320");
    select("Format", "opus");
    expect(screen.getByRole("combobox", { name: "Sample rate" })).toHaveValue("48000");
    expect(screen.getByRole("combobox", { name: "Sample rate" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Bitrate" })).toHaveValue("192");
  });

  it("keeps mono Vorbis bitrate within the offered range", () => {
    const { onExport } = setup();
    select("Format", "ogg");
    select("Bitrate", "320");
    select("Channels", "1");
    expect(screen.getByRole("combobox", { name: "Bitrate" })).toHaveValue("192");
    expect(within(screen.getByRole("combobox", { name: "Bitrate" })).queryByRole("option", { name: "320 kbps" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Export Audio" }));
    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ format: "ogg", channels: 1, bitrate: 192 }), "download");
  });

  it("forwards marked ranges and the chosen file delivery without changing the format", () => {
    const { onExport } = setup({ markedRange: { startTime: 2, endTime: 4 } });
    select("Format", "opus");
    select("Save audio", "file");
    fireEvent.click(screen.getByRole("radio", { name: "Marked In/Out" }));
    fireEvent.click(screen.getByRole("button", { name: "Export Audio" }));
    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ format: "opus", range: { startTime: 2, endTime: 4 } }), "file");
    fireEvent.click(screen.getByRole("radio", { name: "Entire timeline" }));
    fireEvent.click(screen.getByRole("button", { name: "Export Audio" }));
    expect(onExport).toHaveBeenLastCalledWith(expect.objectContaining({ range: undefined }), "file");
  });

  it.each([
    null, { startTime: -1, endTime: 2 }, { startTime: 2, endTime: 2 },
    { startTime: 4, endTime: 2 }, { startTime: 2, endTime: 11 }, { startTime: NaN, endTime: 4 },
  ])("disables marked-section export for invalid marks: %j", (markedRange) => {
    setup({ markedRange });
    expect(screen.getByRole("radio", { name: "Marked In/Out" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "Entire timeline" })).toBeChecked();
  });

  it("blocks export if a selected marked range disappears instead of exporting the whole timeline", () => {
    const { props, rerender, onExport } = setup({ markedRange: { startTime: 2, endTime: 4 } });
    fireEvent.click(screen.getByRole("radio", { name: "Marked In/Out" }));
    rerender(<ExportAudioDialog {...props} markedRange={null} />);
    expect(screen.getByRole("button", { name: "Export Audio" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Mark a valid In/Out range");
    fireEvent.click(screen.getByRole("button", { name: "Export Audio" }));
    expect(onExport).not.toHaveBeenCalled();
  });

  it("resets to the entire timeline when reopened", () => {
    const { props, rerender, onExport } = setup({ markedRange: { startTime: 2, endTime: 4 } });
    fireEvent.click(screen.getByRole("radio", { name: "Marked In/Out" }));
    rerender(<ExportAudioDialog {...props} isOpen={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<ExportAudioDialog {...props} />);
    expect(screen.getByRole("radio", { name: "Entire timeline" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Export Audio" }));
    expect(onExport).toHaveBeenCalledWith(expect.objectContaining({ range: undefined }), "download");
  });

  it.each([{ hasAudio: false }, { duration: 0 }, { duration: -1 }, { duration: NaN }])("blocks empty or muted audio exports: %j", (overrides) => {
    const { onExport } = setup(overrides);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Audio" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Export Audio" }));
    expect(onExport).not.toHaveBeenCalled();
  });

  it("does not download encoder assets while selecting settings, and can cancel without exporting", () => {
    const request = vi.spyOn(globalThis, "fetch");
    const { onExport, onClose } = setup();
    for (const format of ["mp3", "aac", "ogg", "opus"]) select("Format", format);
    expect(screen.getByText(/FFmpeg assets are downloaded on demand/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onExport).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
});
