/** Transcript content, independent of how the text was produced. */
export interface TranscriptionSegment {
  readonly text: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly confidence: number;
}

export interface TranscriptionResult {
  readonly success: boolean;
  readonly segments: TranscriptionSegment[];
  readonly error?: string;
  readonly language?: string;
}
