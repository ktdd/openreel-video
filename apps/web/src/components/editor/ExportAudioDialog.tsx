import React, { useEffect, useState } from "react";
import { Download, Music } from "@/icons/lucide-compat";
import {
  ToolcraftButton as Button,
  ToolcraftDialog as Dialog,
  ToolcraftDialogHeader as DialogHeader,
  ToolcraftLayout as Layout,
  ToolcraftLayoutContent as LayoutContent,
  ToolcraftLayoutFooter as LayoutFooter,
  ToolcraftSelectControl as Selector,
} from "@openreel/ui";
import {
  DEFAULT_AUDIO_SETTINGS,
  getAudioExportValidationError,
  type AudioExportSettings,
} from "@openreel/core";
import type { ExportDeliveryMode } from "../../services/export-runner";

interface ExportAudioDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: AudioExportSettings, delivery?: ExportDeliveryMode) => void;
  duration: number;
  hasAudio: boolean;
  markedRange?: AudioExportSettings["range"] | null;
}

const FORMAT_OPTIONS = [
  { value: "wav", label: "WAV — Uncompressed" },
  { value: "mp3", label: "MP3" },
  { value: "aac", label: "AAC — ADTS" },
  { value: "ogg", label: "Ogg — Vorbis" },
  { value: "opus", label: "Opus — Ogg container" },
] as const;

function sampleRatesFor(format: AudioExportSettings["format"]): AudioExportSettings["sampleRate"][] {
  if (format === "opus") return [48000];
  return format === "wav" ? [44100, 48000, 96000] : [44100, 48000];
}

function bitratesFor(settings: AudioExportSettings): number[] {
  if (settings.format === "opus") return [32, 48, 64, 96, 128, 160, 192, 256];
  const bitrates = [64, 96, 128, 160, 192, 256, 320];
  return settings.format === "ogg" && settings.channels === 1
    ? bitrates.filter((bitrate) => bitrate <= 192) : bitrates;
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds - minutes * 60).toFixed(3).padStart(6, "0")}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const ExportAudioDialog: React.FC<ExportAudioDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  duration,
  hasAudio,
  markedRange = null,
}) => {
  const [settings, setSettings] = useState<AudioExportSettings>({
    ...DEFAULT_AUDIO_SETTINGS,
    format: "wav",
    bitDepth: 24,
    bitrate: 192,
  });
  const [delivery, setDelivery] = useState<ExportDeliveryMode>("download");
  const [exportSection, setExportSection] = useState<"all" | "range">("all");
  useEffect(() => { if (isOpen) setExportSection("all"); }, [isOpen]);

  const validMarkedRange = markedRange && Number.isFinite(markedRange.startTime)
    && Number.isFinite(markedRange.endTime) && markedRange.startTime >= 0
    && markedRange.endTime > markedRange.startTime && markedRange.endTime <= duration + 1e-7
    ? markedRange : null;
  const range = exportSection === "range" ? validMarkedRange ?? undefined : undefined;
  const exportDuration = exportSection === "range"
    ? range ? range.endTime - range.startTime : 0 : duration;
  const effectiveSettings: AudioExportSettings = { ...settings, range };
  const validationError = !hasAudio ? "Add or unmute audio on the timeline before exporting."
    : exportSection === "range" && !range ? "Mark a valid In/Out range on the timeline."
      : getAudioExportValidationError(effectiveSettings, duration);
  const isWav = settings.format === "wav";
  const sampleRates = sampleRatesFor(settings.format);
  const bitrates = bitratesFor(settings);
  const bytesPerSecond = isWav
    ? settings.sampleRate * settings.channels * settings.bitDepth / 8
    : settings.bitrate * 1000 / 8;
  const estimatedBytes = Math.max(0, exportDuration) * bytesPerSecond + (isWav ? 44 : 0);

  const updateSettings = (patch: Partial<AudioExportSettings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      if (!sampleRatesFor(next.format).includes(next.sampleRate)) next.sampleRate = 48000;
      if (!bitratesFor(next).includes(next.bitrate)) next.bitrate = 192;
      return next;
    });
  };

  const handleExport = () => {
    if (validationError) return;
    onExport(effectiveSettings, delivery);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()} width={600} purpose="form" className="rounded-xl">
      <Layout
        header={
          <DialogHeader
            title="Export Audio"
            subtitle="Export your timeline’s audio without a video track."
            startContent={<Music size={20} className="text-accent" aria-hidden />}
            onOpenChange={(open) => !open && onClose()}
          />
        }
        content={
          <LayoutContent className="space-y-5 px-5 py-4">
            <fieldset className="space-y-2">
              <legend className="text-[12px] font-semibold text-fg">Export section</legend>
              <div className="flex flex-wrap gap-4 text-[12px] text-fg">
                <label className="flex items-center gap-2">
                  <input type="radio" name="audio-export-section" checked={exportSection === "all"} onChange={() => setExportSection("all")} />
                  Entire timeline
                </label>
                <label className={`flex items-center gap-2 ${!validMarkedRange ? "text-fg-muted" : ""}`}>
                  <input type="radio" name="audio-export-section" checked={exportSection === "range"} disabled={!validMarkedRange} onChange={() => setExportSection("range")} />
                  Marked In/Out
                </label>
              </div>
              <p className="text-[11px] text-fg-muted">
                {validMarkedRange
                  ? `${formatTime(validMarkedRange.startTime)} – ${formatTime(validMarkedRange.endTime)}`
                  : "Mark In and Out on the timeline to export a section."}
              </p>
            </fieldset>

            <section aria-labelledby="audio-custom-settings" className="space-y-3 border-t border-border pt-4">
              <h3 id="audio-custom-settings" className="text-[13px] font-semibold text-fg">Custom Settings</h3>
              <Selector<AudioExportSettings["format"]>
                label="Format"
                value={settings.format}
                onChange={(format) => updateSettings({ format })}
                options={FORMAT_OPTIONS}
                width="100%"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Selector
                  label="Sample rate"
                  value={String(settings.sampleRate)}
                  onChange={(value) => updateSettings({ sampleRate: Number(value) as AudioExportSettings["sampleRate"] })}
                  options={sampleRates.map((rate) => ({ value: String(rate), label: `${rate / 1000} kHz` }))}
                  isDisabled={sampleRates.length === 1}
                  width="100%"
                />
                <Selector
                  label="Channels"
                  value={String(settings.channels)}
                  onChange={(value) => updateSettings({ channels: Number(value) as AudioExportSettings["channels"] })}
                  options={[{ value: "1", label: "Mono" }, { value: "2", label: "Stereo" }]}
                  width="100%"
                />
                {isWav ? (
                  <Selector
                    label="Bit depth"
                    value={String(settings.bitDepth)}
                    onChange={(value) => updateSettings({ bitDepth: Number(value) as AudioExportSettings["bitDepth"] })}
                    options={[
                      { value: "16", label: "16-bit PCM" },
                      { value: "24", label: "24-bit PCM" },
                      { value: "32", label: "32-bit float" },
                    ]}
                    width="100%"
                  />
                ) : (
                  <Selector
                    label="Bitrate"
                    value={String(settings.bitrate)}
                    onChange={(value) => updateSettings({ bitrate: Number(value) })}
                    options={bitrates.map((bitrate) => ({ value: String(bitrate), label: `${bitrate} kbps` }))}
                    width="100%"
                  />
                )}
              </div>
              <p className="text-[11px] text-fg-muted">
                {isWav ? "WAV is uncompressed; file size depends on sample rate, channels and bit depth."
                  : "Bitrate is a target; the final file size may vary."}
                {settings.format === "opus" && " Opus uses a 48 kHz sample rate."}
              </p>
            </section>
            <Selector<ExportDeliveryMode>
              label="Save audio"
              value={delivery}
              onChange={setDelivery}
              options={[
                { value: "download", label: "Download to this device" },
                { value: "file", label: "Choose a file location" },
              ]}
              width="100%"
            />
            {!isWav && (
              <p className="text-[11px] text-fg-muted">
                If this browser cannot encode the selected format, FFmpeg assets are downloaded on demand. Your audio stays on this device.
              </p>
            )}
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider className="flex-col items-stretch gap-3 px-5 py-3">
            {validationError && <p role="alert" className="text-[12px] text-status-warning">{validationError}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-fg-muted">
                {Number.isFinite(exportDuration) && exportDuration > 0
                  ? `${formatTime(exportDuration)} · ~${formatBytes(estimatedBytes)}` : "No audio to export"}
              </p>
              <div className="flex items-center gap-2">
                <Button label="Cancel" variant="ghost" onClick={onClose} />
                <Button label="Export Audio" icon={<Download size={16} aria-hidden />} variant="primary" onClick={handleExport} isDisabled={Boolean(validationError)} />
              </div>
            </div>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
};
