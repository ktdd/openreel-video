import { AutoCaptionPanel } from "../AutoCaptionPanel";
import { InspectorSection } from "../shell/InspectorSection";

/** Recognition only; manual caption/audio/video utilities live in neutral sections. */
export function AiTab({ clipId, showAudioEffects, captionWordsPerLine }: {
  clipId: string; showAudioEffects: boolean; captionWordsPerLine: number;
}) {
  return showAudioEffects ? <InspectorSection title="Local Auto-Captions" sectionId="auto-captions" defaultOpen={false}>
    <AutoCaptionPanel clipId={clipId} maxWordsPerLine={captionWordsPerLine} />
  </InspectorSection> : null;
}
