import type { ChangeEvent, RefObject } from "react";
import { ToolcraftButton as Button } from "@openreel/ui";
import { CaptionEditorPanel } from "./CaptionEditorPanel";
import { AutoEditPanel } from "../panels/AutoEditPanel";
import { HighlightExtractorPanel } from "../panels/HighlightExtractorPanel";
import { InspectorSection } from "./shell/InspectorSection";

export function CaptionTools({ input, onImport, wordsPerLine, onWordsPerLineChange }: {
  input: RefObject<HTMLInputElement | null>;
  onImport: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  wordsPerLine: number;
  onWordsPerLineChange: (value: number) => void;
}) {
  return <InspectorSection title="Captions" sectionId="editable-captions" defaultOpen={false}>
    <input ref={input} type="file" aria-label="Import SRT or VTT file" accept=".srt,.vtt,text/srt,text/vtt,text/plain" className="hidden" onChange={(event) => { void onImport(event); }} />
    <Button label="Import SRT / VTT as Text" onClick={() => input.current?.click()} variant="secondary" size="sm" />
    <CaptionEditorPanel maxWordsPerLine={wordsPerLine} onMaxWordsPerLineChange={onWordsPerLineChange} />
  </InspectorSection>;
}

export function AudioUtilities({ clipId, onCleanup, cleaning, cleaned, disabled }: {
  clipId: string; onCleanup: () => Promise<void>; cleaning: boolean; cleaned: boolean; disabled: boolean;
}) {
  return <>
    <InspectorSection title="Dialogue Cleanup" sectionId="dialogue-cleanup" defaultOpen={false}>
      <Button label={cleaning ? "Cleaning up..." : cleaned ? "Noise Reduced" : "Quick Dialogue Cleanup"} onClick={onCleanup} isDisabled={cleaning || disabled} variant="secondary" size="sm" />
    </InspectorSection>
    <InspectorSection title="Beat-Synced Edit" sectionId="auto-edit" defaultOpen={false}>
      <AutoEditPanel onClose={() => {}} />
    </InspectorSection>
    <InspectorSection title="Energy Highlights" sectionId="highlights" defaultOpen={false}>
      <HighlightExtractorPanel clipId={clipId} />
    </InspectorSection>
  </>;
}
