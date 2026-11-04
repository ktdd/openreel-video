# AI removal: Phase 1C implementation

Phase 1C removes the **entire Multi-Camera Editing feature**, including deterministic tools. Existing Phase 1B working-tree changes were preserved. Phases 2–5 remain pending; this is not a whole-application AI-absence claim.

## Removal

- Deleted `MultiCameraPanel`, its workflow and feature-success tests; removed the inspector section, AI-tools card and barrel export. The runtime audit includes search/navigation, compact layouts and desktop remnants; no multicam target remains.
- Deleted camera grouping/switching, sync/drift/bleed calibration, activity/VAD/face/transcript analysis, cut planning/review/overrides, layouts/social candidates and `.orma`/OTIO workflows: core `multicam/`, `video/multicam-engine.ts`, web multicam services and analysis worker.
- Deleted all eight multicam agent tools, their domain, host interface, live-host property and bridge. Provider/MCP discovery tests assert that these tools are absent; remaining agent packages still compile and pass tests.
- Removed `Project.multicamGroups`, action types/handlers/registration (`setAll`, `applyEdit`, `restoreEdit`), engine-store fields/getter, project engine synchronization and portable-edit/history snapshot fields. No stub engine, old-group reader, action translation or migration was added.
- Deleted the analysis database client; no database deletion, startup cleanup or unrelated media/storage reset was added. Ordinary source media remains untouched.
- Importer audit found no retained consumer of core's direct `onnxruntime-web` or `yaml` dependencies; removed both. Bun **1.4.3** regenerated `bun.lock`, and `bun install --frozen-lockfile` passed. Whisper's existing transitive ONNX runtime remains, now deduplicated at the lockfile's top level. Shared MediaPipe, codecs, FFmpeg, audio helpers and `idb-keyval` remain for their retained consumers. No multicam-only tracked public assets were found.
- Deleted `apps/web/docs/multicam-editing.md` rather than replacing it with a retirement page, per the user's clarification. Removed the stale multicam limitation from the mixed portable-edit guide. Historical Phase 0/1A/1B evidence, `README.md` and `CONTRIBUTING.md` are unchanged.

## Regression coverage

- `apps/web/src/stores/project/multitrack-editing.test.ts`: ordinary overlapping video tracks; trim, transforms and opacity keyframes; hide/mute/solo states; grouped undo/redo; generic track grouping/locking; portable roundtrip and current project load with Blob identity preserved. Load/edit tests forbid workers and requests.
- Core project-serializer tests: current-format multi-track storage and project-JSON roundtrips retain IDs, media references, source ranges, transforms/keyframes, generic groups and track states. Media blobs restore from storage; JSON retains ordinary missing-media/relink behavior.
- Core export tests: full ordinary multi-track project, including hidden/muted tracks, transforms/keyframes and source references, reaches frame/audio rendering unchanged. Export completes without analysis workers or model requests. Rendering/encoding boundaries are mocked in this unit test, not in the browser smoke below.
- `scripts/ai-removal-phase1c.test.mjs`: recursive runtime-source absence checks across web, server functions and packages; deleted-file checks; dependency checks. This covers preview/export sources, worker constructors, project loading, storage and agent/desktop surfaces, not merely visible buttons.
- Existing portable editing, creation sync, Recipes, export presets, project packaging/recovery and ordinary editing suites remain passing.

## Automated checks

All passed:

```sh
bun run typecheck
bun run test
bun run lint
bun run build
bun run check:retired-cloud-gpu
node --test scripts/ai-removal-phase1a.test.mjs scripts/ai-removal-phase1b.test.mjs scripts/ai-removal-phase1c.test.mjs
```

- **9 workspace typechecks passed.**
- **416 test files passed; 3,044 tests passed; 27 existing skips.** Removed feature-success tests account for the reduced count.
- Lint: **0 errors, 107 existing warnings**.
- Production build passed (**6,275 modules transformed**); existing mixed-import/large-chunk warnings remain. No multicam, Silero, face-landmarker, `.orma` or OTIO identifier matched the emitted JS/HTML audit.
- Retired-cloud-GPU check passed over **1,242 runtime source files**. All **8** Phase 1A/1B/1C source checks passed.
- Existing jsdom WebGL2 and Node FFmpeg diagnostics remain; they did not fail the suites.

## Real-browser smoke and exported-file inspection

Used installed headless Microsoft Edge, a fresh disposable browser profile and the normal web Vite configuration on port 5179. A local, dependency-free Node/CDP harness drove the actual editor stores and engines, not mocked media/rendering. This was **programmatic browser testing**, not a hand-driven file-picker/export-dialog test.

1. Opened the editor at 1440×900; checked multicam UI absence with no selection, one selected clip and multiple selected clips.
2. Imported the validator's two-second 640×360, 24 fps H.264/AAC fixture through the real media importer. Trimmed In to **0.5 seconds**, verified undo/redo, and added a second overlapping video track with transforms/keyframes, generic grouping and hidden/muted/locked state; the base track was soloed.
3. Reloaded the current project through the store, rendered a 640×360 preview frame and exported through the real browser export engine.
4. The resulting **295,769-byte MP4** contained **36 frames**, **1.500000 seconds**, **640×360 H.264 at 24 fps**, and **48 kHz stereo AAC**. Independent ffprobe checks and full FFmpeg decode passed:

```sh
node apps/web/scripts/validate-browser-export.mjs fixtures .codex-audit/phase1c/fixtures
node apps/web/scripts/validate-browser-export.mjs verify trim-start .codex-audit/phase1c/trimmed.mp4
```

The validator now includes the `trim-start` case for repeating this flow manually.

CDP captured **784 page requests** and target events across startup, import/trim, load/preview and export; pre-navigation instrumentation also recorded Worker constructor URLs and IndexedDB opens. No multicam/Silero/face-model request, multicam worker entry point or multicam analysis database initialization was observed. Only ordinary font, autosave, motion-preset and media databases opened; there were no uncaught page exceptions. Blob-URL workers and the retained FFmpeg worker still exist; URL observations alone do not identify arbitrary blob source, so recursive source absence checks independently cover the removed analysis implementation. Font/FFmpeg networking is outside this removal scope.

Raw logs are ignored `phase1c-*.log` files. The local CDP harness, request/worker/database report, fixtures, exported MP4 and independent validation JSON are under ignored `.codex-audit/phase1c/`.

## Remaining release work

Repeat the hand-driven import → trim → export-dialog/download flow, wide/compact UI and GPU preview comparisons on supported browsers as part of Phase 5. This phase does not prove every visual transform or audio-mix result in every backend. Remaining chat, generation, Whisper and segmentation paths can still use AI/network services until their scheduled removal; no replacement inference backend or legacy compatibility layer was introduced.
