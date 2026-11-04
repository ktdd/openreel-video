# AI removal: Phase 2 — first three checkboxes

Implements only the first three checkboxes of [Phase 2](remove-ai-features.md). The working tree was clean before this change. No agent workspace packages, inference dependencies, lockfile entries, remaining shader/voice generation implementations or general AI transport/proxy routes were removed in this partial phase.

## Implemented

### 1. Remove chat navigation and layout

- Removed the toolbar's Manual/AI editing switch, action-rail chat button and AI search wording, compact AI workspace tab, chat grid column/resizer and chat layout state. The inspector remains mounted alongside the viewer; compact mode now has Timeline, Media and Edit tabs.
- Removed desktop chat title-bar actions, dock column, resizer and chat-only persisted-size client. Native project actions, export, lifecycle/autosave and crash handling remain.
- Removed `agentChat` from panel types/defaults and its initialization migration. No new migration, preference reset or storage sweep was added.
- Audited `ai-workspace.css`: all 13 lines were chat-only responsive overrides. Deleted it; retained `editor-responsive.css`, manual layout rules, panel resizers and keyboard navigation. Updated the compact tab grid to three columns.

### 2. Remove chat/MCP editing runtime

- Deleted the chat directory, conversations/history store, chat execution store and ephemeral connection store, including feature-success tests.
- Deleted web agent-only editing adapters, host/singleton, tool catalog/executor, direct chat transport, model discovery/catalog, MCP listener and export-job adapter, plus their dedicated tests. The neutral `services/editing/` transactions, portable JSON/presets/relinking and creation synchronization remain.
- Removed desktop MCP listener installation, MCP bridge/status contracts, settings panel, settings identifiers and trust/approval/dry-run state. Removed the chat-only AI Editor/connection settings panels and stale creation-panel copy pointing users to MCP.
- **Intentional exception:** `services/agent/llm-transport.ts` and its test are still used by `GenerateShaderBox`. They are not agent-only and remain for the later shader-generation checkbox. The remaining agent packages also remain for their explicit later deletion. This is not a claim that the entire app is independent of `@openreel/agent` yet.

### 3. Remove Kie generation and pending jobs

- Deleted `AIGenTab`, all Kie dialogs/forms/model picker, provider/upload/generation/result helpers, the task store and startup poller.
- Removed Kie launch/retry controls, progress/error badges, pending placeholders and task mutation methods from Assets/project state. Removed `MediaItem.isPending`, `kieaiError`, `kieaiTaskId` and their preview-proxy checks. Ordinary missing-media detection, replace/relink controls, media storage and decoded/completed media remain.
- Removed Kie's service registration and the now-unused aggregator selector/state. Broader provider/vault settings remain for their scheduled checkbox.
- No independent Kie processing-manager kind existed: its task store and producers/consumers were deleted together. The shared processing manager still handles ordinary effects/color/reframing and Phase 3's still-live background-removal feature; that feature's processing type was not prematurely removed.
- Rescued the mixed tab's other consumers: music/SFX browsing is under **Audio**, filter presets under **Effects → Filter Presets**, and the deferred speech panel under **Text → Text to Speech**. Title presets, Recipes, canvas backgrounds, manual captions and shader execution remain. Speech's unsaved-audio navigation warning remains until speech removal.

No legacy reader, retirement placeholder, credential/model-cache cleanup or deletion of project/media/user preference storage was introduced. Completed generated media stays ordinary media; generated shader definitions and current project content are unchanged.

## Automated verification

All passed:

```sh
bun run typecheck
bun run test
bun run lint
bun run build
bun run check:retired-cloud-gpu
node --test scripts/ai-removal-phase1a.test.mjs scripts/ai-removal-phase1b.test.mjs scripts/ai-removal-phase1c.test.mjs scripts/ai-removal-phase2-first3.test.mjs
```

- **9 workspace typechecks passed.**
- **402 test files passed; 2,932 tests passed; 27 existing skips.** Removed chat/MCP success-path tests account for the reduced count. Remaining agent/core suites pass unchanged.
- Lint: **0 errors, 105 warnings** (down from 107 as removed code took its warnings with it).
- Production build passed: **5,980 modules transformed**. Existing mixed-import/large-chunk warnings and jsdom WebGL2/Node FFmpeg diagnostics remain. Emitted JS/HTML audit found no chat-panel/state, MCP-listener or Kie-generation identifiers/URLs.
- Retired-cloud-GPU check passed over **1,186 runtime source files**; all **11** phase source checks passed. Phase 1B's source guard now checks that chat is deleted instead of trying to read the removed file; historical evidence/fixtures are unchanged.

Regression coverage includes:

- Wide/compact manual tabs, preservation of mounted media/inspector/timeline state, media-panel keyboard/pointer resizing, desktop manual dock regions and current persisted manual dimensions.
- No AI-generation tab/chat action/AI Editor or MCP settings; music/filter/title/deferred-speech routing and retained audio-mixer/settings navigation.
- A completed generated image remains in the library with its Blob identity, can be added to the ordinary timeline, and does not expose generation/retry controls. Missing-media replacement and folder relinking remain available without network calls.
- Existing portable-edit atomic history/rollback/relinking, creation sync, Recipes/export presets, project packaging/recovery, multi-track persistence and export suites remain passing.
- Recursive source/deleted-file guards cover removed web entry points, layout/state, MCP and Kie implementations while explicitly preserving deferred features and the shader transport.

## Real-browser and export checks

Used installed headless Microsoft Edge with a new disposable profile, the normal Vite app configuration and CDP logging; no browser dependencies were added. Navigation clicks used real DOM buttons. Media edits/render/export used real stores/engines, not mocked codecs or GPU APIs (Edge used SwiftShader).

- At **1440×900**, confirmed no chat/editing-mode switch or AI Generate entry. Opened Audio, Effects → Filter Presets and Text; verified music, filters, titles and the deferred speech entry remain accessible without invoking speech generation.
- At **390×844**, confirmed exactly **Timeline / Media / Edit** workspace tabs, switched between them and returned to wide mode. No chat panel was mounted.
- Imported the existing two-second 640×360, 24 fps H.264/AAC fixture, trimmed In to **0.5 seconds**, checked undo/redo, and edited a second overlapping track with transforms/keyframes and ordinary group/visibility/audio/lock states.
- Loaded the current project through the store, rendered a 640×360 preview frame and exported through the browser engine. Independent ffprobe verification and full FFmpeg decode passed: **295,775 bytes**, **36 frames**, **1.500000 seconds**, **640×360 H.264 at 24 fps**, **48 kHz stereo AAC**.

```sh
node apps/web/scripts/validate-browser-export.mjs verify trim-start .codex-audit/phase2-first3/trimmed.mp4
```

CDP recorded **724 page requests** across boot, manual navigation, load/preview and export. Worker constructors, IndexedDB opens/deletes and storage reads were also instrumented before navigation. No retired chat/MCP web-service or Kie request/client/job-store read was observed. No database deletion or uncaught page exception occurred; an unrelated test preference remained intact. The ordinary font/autosave/motion-preset/media databases and retained Blob/FFmpeg workers still initialized. Source guards independently verify removed implementations; Blob worker URLs alone are not proof of worker contents. Remaining font/FFmpeg networking is outside this feature-removal scope.

Raw evidence is ignored `phase2-first3-*.log` files and `.codex-audit/phase2-first3/` (local CDP harness, request/worker/storage report, exported MP4 and validation JSON). Phase 0/1A/1B/1C evidence, `README.md`, `CONTRIBUTING.md`, package manifests and `bun.lock` are unchanged.

## Deferred, not completed

Phase 2 checkboxes 4–8 remain unchecked: ElevenLabs/voice/script generation; shader authoring requests; remaining provider/vault settings; API transports/proxy routes; agent workspace/dependency deletion. Whisper/segmentation and their processing paths remain Phase 3 work. A hand-driven file-picker/export-dialog/download test and broader cross-browser/visual comparisons remain release-gate work. These results establish the requested partial removal, not whole-application AI or network absence.
