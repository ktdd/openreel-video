# AI removal: Phase 3 completed

Implements [Phase 3](remove-ai-features.md): remove browser/on-device transcription and person/background segmentation, preserving manual caption content and deterministic editing. The working tree was clean before this phase. Phase 0/1A/1B/1C/2 evidence and historical fixtures remain unchanged. Phases 4–5 still require their broader audits/release checks.

## Removed implementations

### Whisper and browser speech recognition

- Deleted `AutoCaptionPanel`, Whisper worker/model catalog, audio resampling helper and its tests. The converter had no retained consumer. Multicam transcription acquisition was already deleted in Phase 1C and remains absent.
- Deleted `speech-to-text-engine.ts`, browser `SpeechRecognition` declarations/initialization and the engine-store getter/state/cache entry points.
- Moved **content-only** `TranscriptionSegment` / `TranscriptionResult` interfaces to `packages/core/src/text/transcript-types.ts`, exported through the text barrel. No recognition options, callbacks, model catalog or executable acquisition API remains.
- Preserved independent subtitle parsing/export, SRT/VTT-to-editable-text import, caption text/timing/words/metadata, title editing, caption selection/editing utilities and ordinary audio import. Old provenance in historical fixtures remains ordinary data, not a runtime recognition path.

### Segmentation in preview **and** export

Deleted all of `packages/core/src/ai/`: background removal, person segmentation engine/worker/protocol, temporal masks and dedicated inference-success tests. Removed the root AI barrel export. The previously extracted heuristic reframer remains under `video/auto-reframe-engine.ts`.

Removed `BackgroundRemovalSection`, `BehindSubjectSection`, their inspector/search/barrel entries, the background-removal processing task kind and `updateTextBehindSubject` store APIs. Removed the `behindSubject` field from text/update types and TitleEngine updates. No fallback flag, warning, legacy reader or migration was added.

Audited and changed all three relevant rendering surfaces:

- **`Preview.tsx`:** removed person-engine imports, subject stream IDs, weak caches, temporal occlusion logic, extra subject-frame captures/close lifecycle and first-inference text-hiding branches. Replaced the subject wrapper with the neutral `renderTextClipWithEffects`, retaining ordinary effects. Updated direct seek, placeholder, native playback, edge/clip transition and multi-track playback paths. Removed subject-only GPU restrictions while retaining ordinary text/shape/motion/manual-mask exclusions and existing frame cleanup.
- **`preview/canvas-renderers.ts`:** removed inference processing from both bitmap and canvas effect paths. Kept effects, grading and canvas fast paths.
- **`video-engine.ts`:** removed both background processing and person-mask caches/captures/compositing, including transition captures. Titles now render directly through the existing effect-aware title renderer in track order. Removed the inference-only realtime frame option and updated playback/render-bridge callers; the unused overlay option fields were not a working override mechanism. Ordinary dimensions, frame ownership, graphics, transitions, subtitles, grading, masks and effects remain.

Chroma key/Green Screen, drawn/manual masks, DSP dialogue cleanup, energy highlights, beat-based editing, stabilization, resizing/upscaling, Recipes, saved shaders and creation backends are preserved. No multicam replacement or inference fallback was introduced.

### Navigation and offline support

Deleted the mixed `AiTab` (its last consumer was automatic captions), removed `ai` from inspector tab types/maps and updated navigation tests. Retained neutral caption/audio sections and direct search routes. Tours were already absent; no retired availability/tooltips/search targets remain in runtime source.

Removed `isAIAvailable` and the public service worker's recognition/provider-specific availability protocol. Static caching and network-only API handling remain: optional connected services receive a generic network error when offline, not an AI-specific response. No service-worker version bump, cache sweep or user-data cleanup was added.

### Last-consumer dependency audit

Before deletion, the only remaining Transformers import was the Whisper worker; MediaPipe imports belonged to the deleted person-segmentation worker. Removed web's `@huggingface/transformers` and web/core's `@mediapipe/tasks-vision`. Core's direct ONNX dependency was already removed in Phase 1C; Whisper's transitive ONNX packages now disappear too.

Regenerated `bun.lock` using **Bun 1.4.3**, reviewed pruning/hoist changes and passed a subsequent frozen install. The current manifests and lockfile have no Transformers, MediaPipe, ONNX or removed agent workspaces. The lockfile's added `yallist` entry is a retained dependency's hoist, not a new direct dependency. FFmpeg patches and ordinary WebCodecs/Web Audio/WebGPU, native/WASM/CPU creation support remain. This completes the corresponding inference-dependency checkbox in Phase 4, not Phase 4's broader UI/dependency/documentation audit.

No model-cache cleanup, credential access, database deletion, project/media reset or upgrade compatibility client was introduced. Removing model/runtime clients does not delete stored user content.

## Automated verification

All passed:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run lint
bun run build
bun run check:retired-cloud-gpu
node --test scripts/ai-removal-phase*.test.mjs
```

- **5 workspace typechecks passed.**
- **352 test files passed; 2,372 tests passed; 27 existing skips.** Removed inference/resampling success suites account for the reduced count; no new skips were added.
- **Lint: 0 errors, 103 warnings** (down from 104). Removed newly unused callback dependencies as part of inference detachment; unrelated warnings remain.
- **Production build passed: 5,957 modules transformed.** Existing mixed-import/large-chunk warnings and jsdom WebGL2/Node FFmpeg diagnostics remain non-failing. Emitted JS/HTML audit found no retired inference engines/workers/models, recognition APIs or model/provider library identifiers.
- **25 Node baseline/absence checks passed.** Prior Phase 2 guards now require retained manual captions rather than deleted deferred inference files. Historical evidence was not rewritten.
- Retired-cloud-GPU check passed over **1,071 runtime source files**.

New/updated coverage:

- Inspector/tab-map tests assert no automatic captions, background-removal, behind-subject or AI tab, while manual captions, Green Screen, manual masks, beat editing, highlights and audio controls remain.
- Public VideoEngine frame tests cover visible, hidden-track and out-of-time ordinary titles, retained subtitle drawing, exactly one final bitmap readback (no subject captures), decoded-frame disposal and output caller ownership, without any download. Existing effects/grading/adjustment/transition/manual-mask/shader/GPU lifecycle tests remain passing.
- Existing SRT/VTT parsing, caption editing/timing/selection, serializer/current-project recovery, multi-track editing and creation/saved-shader suites pass unchanged except for removed-feature assertions.
- `scripts/ai-removal-phase3.test.mjs` recursively checks runtime source, public worker, optional server functions, manifests/lockfile, deleted implementations/model assets and retained deterministic content. It does not ban generic masks, models, shaders or generated-content provenance.
- A VM test executes the actual public service worker to verify no startup fetch, retained static asset caching, uncached API responses and ordinary offline network errors.

## Real browser and independent export checks

Used installed headless Microsoft Edge/SwiftShader, normal Vite isolation settings and a new profile. A disposable runner starts a **fresh, directly owned Bun server on port 5183** and terminates it afterward. The harness asserts that creating its project updates the live UI title, avoiding a separate store instance from stale HMR URLs. No browser dependency or application test endpoint was added.

Actual DOM navigation:

- **1440×900:** audio/music, filter presets, titles and manual settings remain; retired generation/provider controls are absent.
- **390×844:** exactly **Timeline / Media / Edit**, all switchable; return to wide mode retains the workspace.
- With a real video selected, manual Green Screen, masking and captions sections remain; automatic-caption/segmentation sections do not exist.
- Expanded Captions and used CDP's native file-input assignment on the real input to import **both SRT and VTT**. This exercises the app's actual change handler and file reader, not an injected caption endpoint. Subsequent caption editing used the real store.

Real editing/rendering, without mocked codecs/renderers:

1. Imported a two-second 640×360 H.264/AAC video and ordinary 48 kHz WAV; trimmed In to **0.5s** and checked undo/redo. Exercised layered video/audio transforms, keyframes, grouping, visibility, locking, solo and mute states.
2. Imported/edited manual captions, created an ordinary title with a distinctive background and added a **0.25s intro crossfade**. Reloaded the current project through the store and verified the caption edit persisted.
3. Compared title-visible/hidden core frames: **22,856 changed pixels**. The actual UI preview contained **12,044 title-background pixels** both during the intro transition at 0.125s and afterward at 0.75s; titles are not skipped pending inference.
4. Repeated saved-generated-shader JSON round-trip/registry checks and real WebGL2 rendering: pixel **[204, 128, 0, 255]**, not the Canvas2D fallback.
5. Rendered a 640×360 frame and exported the five-track project through the browser engine. ffprobe checks and full FFmpeg decode passed: **309,931 bytes**, **36 video frames**, **1.500000 seconds**, **640×360 H.264 at 24 fps**, **48 kHz stereo AAC**.
6. Independently decoded the MP4 at **0.75s** and compared its title region with the raw core preview frame. Export contained **11,594 title-background pixels**; mean RGB absolute error was **7.97/255** across the region, below the 15/255 lossy-encode threshold. This verifies visible exported title content, not merely a playable container.

```sh
node apps/web/scripts/validate-browser-export.mjs verify trim-start .codex-audit/phase3/trimmed.mp4
node .codex-audit/phase3/check-frames.mjs
```

The final browser run recorded **703 page requests**, worker constructors, target URLs, IndexedDB opens/deletes and storage reads across boot, navigation, editing, caption import, reload/preview and export. No retired provider/inference/model/multicam request or identified ML worker/client was observed. No uncaught page exception or database deletion occurred; an unrelated test preference survived. Ordinary font/autosave/motion-preset/media databases and Blob/FFmpeg workers remain. These are page-request and worker-constructor/target observations, not blanket interception of every opaque Blob worker's internal networking; recursive source/dependency/bundle absence checks independently cover removed implementations.

Raw logs are ignored `phase3-*.log`. Disposable harnesses, profile, SRT/VTT/WAV fixtures, raw preview pixels, exported MP4 and reports are ignored under `.codex-audit/phase3/`. `README.md`, `CONTRIBUTING.md` and historical evidence/fixtures remain unchanged.

## Remaining work

Phase 4 still audits unused UI/dependency/assets, current/retired documentation, build configuration and a unified no-AI guard. Phase 5 still includes hand-driven file-picker/export-dialog/download tests, broader offline/cross-browser/GPU visual comparisons and release coverage. The browser run above is automated DOM input/navigation plus real store/engine editing/export, not a claim that every release-gate interaction or backend has been manually verified.
