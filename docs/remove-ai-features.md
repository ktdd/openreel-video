# Plan: strip AI and unwanted product features from the OpenReel fork

## Status and scope

- **Phase 0 completed with user authorization.** Historical baselines and fixtures are saved under `docs/ai-removal-phase0/` and remain unchanged.
- **Phases 1A–1C implemented.** Startup/landing, project/motion template libraries, Screen recorder and both tours are removed; retained manual features are extracted; the entire Multi-Camera Editing feature is removed. See [Phase 1A](ai-removal-phase1a.md), [Phase 1B](ai-removal-phase1b.md) and [Phase 1C implementation and verification](ai-removal-phase1c.md). **Phase 2 is implemented:** chat/agents, external generation, provider/vault settings and the AI proxy are removed; see [Phase 2 implementation and verification](ai-removal-phase2.md). **Phase 3 is implemented:** on-device transcription, browser speech recognition and person/background segmentation are removed; see [Phase 3 implementation and verification](ai-removal-phase3.md). Phases 4–5 remain pending apart from the inference dependency pruning already completed with Phase 3.
- **No backward-compatibility requirement.** The user confirmed there are no older projects to migrate and requested removal of Phase 1B's legacy project/state migrations, startup cleanup and dedicated tests. Do not add old-version readers, retirement placeholders, fallback warnings or storage/credential upgrade sweeps in later phases. Keep normal current-format validation, persistence and data safety.
- Repository inspected at commit `5da5cce`; working tree was clean before this plan was added.
- Confirmed with the user: **remove all AI**, including on-device inference, not just external providers.
- Additional confirmed removals: startup/landing page, all project templates, motion-composition templates, screen recorder, Editor tour, Animation & effects tour, and **all Multi-Camera Editing**, including deterministic/non-AI tools. **Keep Recipes and export presets.**
- After Phase 1A, the user repeated video import → trim start → video export and reported that it works. Multi-Camera Editing was then added to scope with authorization to update the plan only. Its subsequent removal was explicitly authorized and implemented in Phase 1C, not as part of Phase 1A.
- Goal: a manual, local-first video/motion editor that opens directly into editing, with no AI chat, agents, MCP editing, generative services, speech recognition, ML inference/model downloads, project/motion template browsers, screen recording tool, guided tours, or Multi-Camera Editing.
- Scope additions do not rewrite historical evidence. Phase 0 remains the pre-removal baseline; Phase 1A records its completed surface changes, and the newly requested multicam removal needs its own focused tests and evidence in Phase 1C.
- Remove implementations and dependencies, not merely buttons or feature flags. Do not replace removed AI with another provider or inference backend.

### Remove

1. Timeline chat, conversation history, tool-call/approval UI, LLM transports, model discovery, agent runners, and MCP control surfaces.
2. Kie.ai generation/upload/polling, ElevenLabs voice generation and script enhancement, Freepik/provider configuration, and AI shader generation.
3. Whisper automatic captions/transcription, browser SpeechRecognition, MediaPipe background/person segmentation, text-behind-subject segmentation, multicam face analysis, and Silero neural VAD.
4. AI-specific settings, credentials UI, service caches, pending-generation handling, production AI proxy routes, package aliases, tests, and active documentation.
5. The startup/landing screen shown in the user-provided `LandingPage.png`, its “Skip on startup” switch, and welcome-only navigation. Opening the app must behave as if skipping were always selected, without depending on a stored preference.
6. Full-project templates and motion-composition templates: browsing, applying, saving/publishing, template-specific variables UI, bundled scene-template definitions, and template-cloud integration. Do not confuse these with retained Recipes, simple animation presets, or export presets.
7. The Screen recorder tool, including its bundled webcam/microphone options, countdown/controls, service, store, permission requests, and recording-result import callbacks. Existing recorded media remains ordinary usable media.
8. Editor tour and Animation & effects tour, including launch buttons, first-run auto-start behavior, step data, overlays, hooks, and tour-only storage/state.
9. The entire Multi-Camera Editing feature: camera grouping/switching, sync/drift/bleed calibration, activity/reaction/transcript analysis, automatic/manual cut planning and review, multicam layout/social-clip generation, multicam-specific `.orma`/OTIO workflows, agent tools, worker/services, and engine/catalog exports. Remove implementations, not just the inspector panel. Keep ordinary timeline editing and source media; no legacy multicam readers/types or old-project migration are required.

### Preserve

- Import/relink, media library, timeline editing, undo/redo, autosave/recovery, playback, proxies, effects, transitions, keyframes, local export, and project packaging. Retain new/open/save/recent-project access within the editor despite removing the landing page.
- **Recipes:** the clip-scoped editing-template system under `packages/core/src/editing-templates`, including its browser, adjustable controls, and applied content.
- **Export presets:** built-in/custom encoding, resolution, quality, and platform settings. These are separate from project templates; `apps/web/src/services/export-presets.ts` stays.
- Current project/composition text, shapes, media, keyframes, and generic motion variable bindings/manual animation tools. Do not remove shared editing primitives merely because template libraries used them.
- Motion authoring, 3D/creation scene editing/rendering, native/WASM/CPU creation backends, GLSL/WGSL shaders, built-in effects/fills/text shaders, and effect packages.
- Manual captions, SRT/VTT import, caption editing, and existing caption text/timing, regardless of how that text was originally produced.
- Completed generated media and saved shader definitions as ordinary project content; provenance is not an executable AI feature.
- Portable edit JSON, reusable presets, and local-media relinking currently embedded in the chat UI. Move these to a neutral UI rather than deleting them with chat.
- Non-ML automation: beat-based editing, energy-based highlights, DSP audio cleanup, auto-color, chroma key, ordinary resizing/upscaling, and heuristic reframing. Deterministic multicam sync/cut planning is no longer retained; the user requested removal of the entire multicam feature. Relocate and rename misleading AI labels as needed.

This is not a general removal of networking, all desktop compatibility code, motion/3D features, analytics, fonts, or sharing services. Do not expand scope into those unrelated systems.

## Repository findings and dependency traps

| Area | Confirmed locations | Required treatment |
| --- | --- | --- |
| Chat layout and entry points | `apps/web/src/components/editor/{EditorInterface,EditorActionRail,Toolbar,SearchModal}.tsx`, `chat/`, `ai-workspace.css`, `stores/{chat-store,chat-history-store,ai-connection-store}.ts`, `stores/ui-store.ts` | Remove chat controls/state/layout while retaining manual responsive layout, resizers, and keyboard navigation. |
| Agent infrastructure | `apps/web/src/services/agent/`, `packages/{agent,agent-runner,creation-agent}` | Extract non-AI callers first, then delete infrastructure and packages. |
| Manual features coupled to agents | `chat/EditSharingPanel.tsx`, `motion/components/CreationWorkspacePanel.tsx`, `motion/model-inspection.ts` | Sharing uses `EditingSession`, editing tools, and `runExclusive`; creation sync calls `executeTool("sync_creation_scene_to_motion", ...)`; model inspection imports agent-owned types. Decouple before package deletion. |
| Generation | `components/editor/{AIGenTab.tsx,kieai/}`, `services/kieai/`, `hooks/useKieAIPoller.ts`, `stores/{kieai-store,tts-store}.ts`, `App.tsx`, `AssetsPanel.tsx` | Remove generation and its startup poller, retry actions, upload paths, and unsaved-TTS navigation handling. |
| Voice/script generation | `components/editor/inspector/hooks/{useElevenLabsApi,useTtsActions}.ts` and their callers | Trace and remove generation-only panels/constants/hooks; retain unrelated script/caption editing. |
| Shader generation | `services/ai-shader*.ts`, `motion/components/GenerateShaderBox.tsx`, generation controls in `EffectsPanel.tsx` and `PropertiesPanel.tsx` | Remove authoring requests, not shader execution, saved definitions, or manual shader controls. Inspect `(AI)` labels in motion and inspector shader selectors. |
| Settings and transport | `components/editor/settings/`, `stores/settings-store.ts`, `services/{api-proxy,secure-storage}.ts`, `config/api-endpoints.ts`, `functions/api/proxy/[[catchall]].ts` | Remove AI registrations, UI, and production handlers. Secure storage currently serves AI credentials; remove the vault UI/runtime when unused. No credential migration or startup deletion sweep is required. |
| Local transcription | `workers/whisper-{worker,models}.ts`, `utils/whisper-audio.ts`, `inspector/AutoCaptionPanel.tsx`, `services/multicam-transcription.ts`, `packages/core/src/text/speech-to-text-engine.ts` | Delete recognition engines and callers, retaining caption data/import/editor primitives. |
| Person segmentation | `packages/core/src/ai/`, `inspector/{BackgroundRemovalSection,BehindSubjectSection}.tsx`, `Preview.tsx`, `packages/core/src/video/video-engine.ts` | Remove inference in both preview and render/export paths, not only inspector UI. Remove obsolete effect settings/types with the implementation; no old-project fallback is required. |
| Multi-Camera Editing (entire feature) | `inspector/{MultiCameraPanel.tsx,multicam-workflow.ts}`, `InspectorPanel.tsx`, `AIGenTab.tsx`, `services/multicam-*.ts`, `workers/multicam-analysis-worker.ts`, `services/agent/multicam-bridge.ts`, `packages/core/src/{multicam/,video/multicam-engine.ts,actions/handlers/multicam.ts}`, agent multicam tools/contracts | Remove both ML and deterministic multicam authoring/analysis workflows in Phase 1C. Audit action registration, `engine-store.ts`, capability/barrel exports, and persisted `Project.multicamGroups` imports before deleting engine code. Preserve ordinary multi-track editing/transforms and source media; remove multicam-only types without legacy compatibility readers. |
| Mixed AI tab | `inspector/tabs/AiTab.tsx`, `clip-tabs.config.ts`, `InspectorPanel.tsx`, `SearchModal.tsx` | Split retained utilities out before deleting the AI tab and its navigation identifiers. |
| Desktop remnants | `apps/web/src/desktop/DesktopApp.tsx`, `desktop/pages/EditPage.tsx`, settings `McpPanel.tsx`, bridge types/mocks | Desktop app workspace is already absent, but web source still imports chat/MCP. Remove those references without a general desktop teardown. |
| Dependencies/config | web/core `package.json`, root `tsconfig.base.json`, web `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `bun.lock` | Remove agent aliases/packages and inference dependencies after their importers are gone. |
| Startup/landing | `apps/web/src/App.tsx`, `hooks/use-router.ts`, `components/welcome/`, `stores/ui-store.ts`, `EditorActionRail.tsx` | Remove landing/routes/skip preference, but preserve recovery and editor-side project access. `RecoveryDialog` currently lives under `welcome/`; do not delete it with that directory. |
| Project templates | `components/welcome/Template*.tsx`, `editor/panels/TemplatesTab.tsx`, `editor/inspector/{TemplatesBrowserPanel,TemplateVariablesPanel}.tsx`, `editor/SaveTemplateDialog.tsx`, `services/template-cloud-service.ts`, `stores/engine-store.ts`, `packages/core/src/template/` | Remove project-template browsing/application/saving/cloud services and unused engine exports. Keep Recipes under the distinct `editing-templates/` directory. |
| Motion templates | `motion/components/MotionTemplateBrowser.tsx`, `MotionCreatorShell.tsx`, motion tab state, `project-store.ts`'s preset-based composition creation, `packages/core/src/motion/motion-presets.ts` | Remove composition starters and template navigation, not blank composition creation, existing scenes, or single-layer animation/particle/text presets. Audit `motion-template-types.ts` before pruning because Recipes use motion-template metadata types. |
| Screen recorder | `editor/{ScreenRecorder,RecordingCountdown,RecordingControls}.tsx`, `services/screen-recorder.ts`, `stores/recorder-store.ts`, `Toolbar.tsx`, `EditorActionRail.tsx` | Remove the whole recorder lifecycle, modal and callbacks, without touching normal media import, playback or encoded files from earlier recordings. |
| Guided tours | `editor/tour/`, `EditorInterface.tsx`, `EditorActionRail.tsx` | Remove both overlays, launch/auto-start hooks and timers/listeners; preserve the controls and keyboard shortcuts the tours merely point at. |

Important distinctions established by source inspection:

- `services/background-generator.ts` draws Canvas solids/gradients/patterns: **not AI**.
- `services/highlight-service.ts` ranks audio energy and supplied transcript data locally: **not an LLM service**.
- `packages/core/src/video/upscaling/` uses Lanczos, edge-directed processing, and sharpening shaders: **not a neural upscaler**. Preserve it; correct the toolbar's “AI upscaling” copy.
- `packages/core/src/ai/auto-reframe-engine.ts` uses pixel/skin-region heuristics rather than an inference dependency. Move retained functionality out of `ai/`, remove AI claims, and test it. Do not delete aspect-ratio/platform presets merely because of the directory name.
- `InspectorPanel.tsx`'s `handleRemoveBackground` enables chroma key: preserve/relabel this separately from ML background removal.
- `workers/multicam-analysis-worker.ts` performs deterministic drift analysis, not AI, but is now slated for removal with the whole multicam feature. Do not extract/rescue it merely because it is non-ML.
- `packages/creation-schema` currently has agent-package consumers, but contains deterministic schema/builders. Reassess after extracting manual creation sync; do not automatically treat all creation packages as AI.
- “Templates” has several unrelated meanings. `packages/core/src/template/` supplies full-project templates; `motion/motion-presets.ts` supplies whole animated scene starters. Both are removed. `editing-templates/` supplies **Recipes**, while motion animation/particle/text presets and export encoding presets are separate retained tools. Shared type names do not justify deleting them.
- `ProjectSwitcher.tsx` already exposes new projects, saved autosaves, and project files from inside the editor. Use/adapt editor-side project access instead of retaining the landing page to keep those operations available.

## Current-format scope and data safety

The user confirmed there are **no older projects to migrate**. Backward compatibility is not a requirement. Phase 0 fixtures/evidence and Phase 1A's historical record remain unchanged, but they do not impose an upgrade-support obligation on subsequent work.

1. Remove retired features and their state/types/readers rather than adding compatibility layers. No legacy generation placeholders, behind-subject fallback markers/warnings, UI/settings migrations, credential sweeps or model-cache cleanup are needed.
2. Preserve ordinary current-format editing data and primitives: local media/relinking, clips/tracks, creation/motion scenes, captions, shader definitions, generic variables, Recipes and export presets. Keep import validation and current capability/version safeguards.
3. Do not clear project/media storage, all localStorage/IndexedDB, unrelated secrets or origin caches. No incidental startup initialization/deletion of obsolete template or multicam databases is required. Remove unused runtime storage clients, not user data wholesale.
4. Preserve normal autosave/recovery and current-format save/reopen. Startup still opens a blank 1920×1080, 30 fps project only when no recovery/open project exists; explicit new-project settings and shared-video routes remain supported.
5. Remove model/provider/poller initialization paths in their scheduled phases. Do not rely on deleting caches or migrating stored state to make the eventual AI-free editor safe.

## Implementation sequence

Use small, reviewable commits. Each phase should leave the affected workspace typecheckable and focused tests passing. Do not execute the root `clean` script as part of removal.

### Phase 0 — Baseline and fixtures

- [x] Review current changes and `CONTRIBUTING.md`; recheck this inventory against current source. Leave `CONTRIBUTING.md` and `README.md` unchanged per user request.
- [x] Run baseline workspace typecheck/tests, relevant lint, production build, and the retired-cloud-GPU check; record pre-existing failures separately. All passed; existing warnings/skips are recorded.
- [x] Capture current network requests (user-supplied `localhost.har`) and production bundle size for comparison. Layout captures skipped at the user's request; manual comparison remains available.
- [x] Add fixtures for ordinary editing, captions, completed generated media, a pending generation placeholder, saved generated shaders, creation/motion scenes, legacy `behindSubject`, and persisted AI settings/layout.
- [x] Enumerate static importers of agent packages, inference libraries, and AI transports, including tests, source aliases, desktop remnants, Cloudflare functions, and deep imports; document computed-import/barrel limitations and manual audit findings.

**Evidence:** [Phase 0 baseline](ai-removal-phase0/baseline.md), [fixture guide](ai-removal-phase0/fixtures.md), and the adjacent network/bundle/import JSON reports. Raw HAR/logs/build outputs remain local and ignored.

**Exit:** reproducible baseline and fixtures; no implementation decisions depend on deleting files by name alone. No AI runtime behavior changed.

### Phase 1A — Remove the additional unwanted product features

This is the first implementation phase after the completed baseline. Do not move or preserve removed template/recorder/tour features merely because they are non-AI.

- [x] Add focused startup/router tests for clean storage, both old skip-preference values, unknown/legacy welcome/templates/recent links, explicit new-project settings, an existing open project, and recovery accept/dismiss/failure. Add tests proving there is no landing flash, duplicate project creation, template browser, recorder entry point, or first-run tour. Preserve shared-video routes independently.
- [x] Remove `WelcomeScreen` and its hero/format-choice/template-gallery surfaces from app startup; make the default/fallback route editor-first. Remove or repurpose the action-rail home navigation so it cannot return to a deleted page. Remove the skip switch, state action/type and persisted field rather than simply changing its default to true.
- [x] Preserve/rehome `RecoveryDialog` and recovery logic before pruning `components/welcome/`. Keep new/open/save/recent-project access inside the editor via `ProjectSwitcher`/project files UI, adapting it as necessary. Retain project dimension/aspect-ratio settings, export platform presets, and explicit creation routes even though landing-page format cards disappear.
- [x] Remove all full-project template surfaces: welcome gallery/card/preview/category UI, Assets Templates tab, `TemplatesBrowserPanel`, its template-specific variable editor, `SaveTemplateDialog`, and related AI-generation submenu links. Trace and remove browse/apply/save/import/publish template actions rather than leaving unreachable code.
- [x] Remove `template-cloud-service.ts`, unused template endpoints/config, template-engine state/getters in `engine-store.ts`, and full-project template engine/catalog exports once retained users are disentangled. Leave old local template records dormant and never fetch cloud templates. Do not delete Recipes or shared project-format/export preset utilities.
- [x] Remove `MotionTemplateBrowser`, its tab/navigation/state, built-in whole-composition starter catalog (`motion-presets.ts`), preset lookup/application paths in `createMotionComposition`, and their unused exports/tests. `packages/agent/src/registry.ts` also imports `getMotionPreset` for `apply_motion_template`: retire that template-specific tool and its related references/tests in the same change so remaining agent packages still typecheck until Phase 2. Keep blank composition creation, generic variables, existing composition rendering, Recipes and single-layer animation/particle/text presets. Retain or relocate shared `motion-template-types.ts` definitions needed by Recipes or saved data.
- [x] Remove Screen recorder menu/modal, toolbar mount and screen/webcam result-import callbacks, `ScreenRecorder`, `RecordingCountdown`, `RecordingControls`, recorder service/store and unused modal/state types. Remove only recorder-owned media capture/permission/listener/timer code; keep ordinary file import and rendering/playback APIs. Recorded files already in projects stay usable.
- [x] Remove both Editor tour and Animation & effects tour launch items, mounted overlays, `editor/tour/` hooks/step data/popovers, first-run startup effects, storage wiring and tour-only attributes. Keep ordinary tooltips, help/shortcuts, animation tools and effects controls.
- [x] Add legacy template-authored composition/variable and recorded-media roundtrip coverage; verify Recipes can still apply/update/remove, blank motion compositions still work, and built-in/custom export presets are unchanged. Check startup creates no template-cloud request or capture permission prompt and runs no tour timers/listeners.
- [x] Run focused tests/typechecks plus the normal build before proceeding. Record the extra surface changes separately from AI removal so the historical Phase 0 baseline remains meaningful.

**Evidence:** [Phase 1A implementation and verification](ai-removal-phase1a.md). The user subsequently confirmed video import → trim start → video export works. Request/capture absence is covered by component spies and source guards; fresh HAR capture, independent exported-file inspection and broader browser/export verification remain release-gate work.

**Exit:** startup goes straight to the editor (subject to existing loading/recovery safeguards); project/motion templates, screen recorder and both tours are removed; Recipes, export presets, project access/recovery and existing content remain functional.

### Phase 1B — Rescue retained non-AI functionality

- [x] Extract the generic transaction/commit, stale-state checks, engine synchronization, history, relinking, and serialization behavior needed by portable edit/preset operations from `services/agent`. Use a neutral editing service, not an agent host adapter.
- [x] Move `EditSharingPanel` to an ordinary project/share UI. Remove chat resets and implement preset application through validated local editing actions, preserving atomic one-step undo/redo and failure rollback.
- [x] Extract deterministic creation-to-motion synchronization from the agent executor/live host into the creation/project editing layer. Wire `CreationWorkspacePanel` directly to that operation, preserving mutation serialization, error handling, IDs, history, and preview synchronization.
- [x] Move model-inspection types/helpers only if a retained manual consumer needs them; otherwise remove the agent-only inspection feature. Do not retain agent “suggested next tools” as a dependency of manual 3D rendering.
- [x] Move heuristic reframing to a neutral video/editing module and update exports/imports/tests. Separate real behavior from misleading model-loading messages.
- [x] Relocate SRT/VTT import and `CaptionEditorPanel` to text/caption UI; beat sync and energy highlights to neutral editing/audio UI; DSP cleanup and auto-color to audio/color controls; chroma key to effects.
- [x] Per the user's scope correction, remove the initially added legacy project/UI/settings normalization, retirement metadata/warnings, startup storage/credential cleanup and dedicated tests. No older-project support is required.

**Evidence:** [Phase 1B implementation and verification](ai-removal-phase1b.md), including the subsequent removal of legacy compatibility at the user's request. Browser/GPU/export inspection remains release-gate work; this is not a whole-application AI-absence claim.

**Exit:** retained manual features have no dependency on an AI request/tool loop; no Phase 1B upgrade/legacy compatibility layer is retained.

<a id="phase-1c--remove-all-multi-camera-editing-newly-requested-not-implemented"></a>

### Phase 1C — Remove all Multi-Camera Editing (implemented)

This scope addition follows completed Phase 1A and is separate from rescuing retained manual utilities in Phase 1B. Remove multicam even where it is deterministic/non-AI. Complete this before deleting agent infrastructure; do not carry forward the old requirement to keep deterministic multicam usable.

- [x] Add current-format regression tests for generic multi-track editing, transforms/keyframes, track visibility/audio states, media references, history and export. No legacy multicam project/group/`.orma` migration fixtures or readers are required.
- [x] Remove the `Multi-Camera Editing` inspector section, `MultiCameraPanel`, `multicam-workflow`, AI-tools submenu entry, search/navigation targets and any desktop entry points. Remove multicam-only section/tab targets and their types. Preserve ordinary editing of multiple video tracks, clip transforms, grouping and audio controls outside the multicam feature.
- [x] Remove camera-group authoring, sync/drift/bleed calibration, activity/face/transcript acquisition, Silero VAD, cut planning/review/overrides, multicam layout/social-clip generation, `.orma`/OTIO feature workflows, `services/multicam-*` and `workers/multicam-analysis-worker.ts`. Audit imports and rescue only genuinely shared ordinary-media/audio helpers; do not replace removed analysis with another backend.
- [x] Remove multicam agent tools, `services/agent/multicam-bridge.ts`, host contracts/implementations, discovery/prompt references and related feature-success tests together so the remaining agent packages typecheck until Phase 2.
- [x] Remove `packages/core/src/multicam/`, `video/multicam-engine.ts`, multicam action handlers/registrations, `engine-store.ts` state/getters, feature exports and multicam-only project/history types. Audit `multicam/setAll`, `multicam/applyEdit` and `multicam/restoreEdit`; no inert legacy types or action translation are required.
- [x] Remove the multicam runtime storage client. Current workflows must not initialize `openreel-multicam-analysis`, an analysis worker, model or multicam engine. Do not add a startup database cleanup or a legacy group-metadata reader.
- [x] Replace multicam feature-success tests with UI/source absence and ordinary multi-track editing tests. Verify no multicam worker/model/network request on startup, current-format project load, preview or export. Repeat import video → trim start → export video. Phase 1C used headless Edge with real codecs/rendering, programmatic store/engine calls and CDP request/worker/database logging; this is not a hand-driven UI/export-dialog run.
- [x] Run focused web/core/remaining-agent tests and typechecks, then normal workspace checks/build. Record multicam removal separately from Phase 0 and Phase 1A evidence; remove its exclusively used dependencies/assets only after importer audits, without touching shared codecs/audio/rendering packages. Removed core's direct ONNX runtime and YAML dependencies; retained transitive Whisper ONNX and shared MediaPipe for later phases.

**Evidence:** [Phase 1C implementation and verification](ai-removal-phase1c.md). The multicam-only guide was deleted rather than replaced with a retirement page, as requested. No storage cleanup or compatibility reader was added.

**Exit:** no multicam authoring, analysis, sync/cut workflow, `.orma`/OTIO feature UI or agent control surface remains. Generic multi-track editing, transforms, media, history and local export remain functional; no legacy multicam compatibility layer is retained.

### Phase 2 — Remove chat, agents, and generative services

- [x] Remove chat from toolbar, action rail, search, compact panel switcher, editor grid/resizers, default panel state, and desktop source layouts. Audit `ai-workspace.css` before deleting it: preserve any shared manual layout rules under neutral names. That file contained only chat-specific rules; ordinary responsive styles/resizers remain.
- [x] Delete chat components/stores/session connection state and agent-only web services after Phase 1 consumers are detached. Remove MCP listener installation and AI-only bridge contracts/mocks/settings. No web editing host/tool loop remains. The shared LLM transport retained during the partial implementation has now been deleted with shader generation.
- [x] Remove AI generation tabs/dialogs/forms, the Kie.ai startup poller in `App.tsx`, provider clients, upload/download helpers, task store, pending/retry media actions, and AI-only processing task types. Removed Kie job fields and producer/consumer paths, not ordinary missing-media placeholders. Music and filter presets have neutral homes; the temporarily rehomed speech UI has now been removed. Background-removal processing remains with its still-live Phase 3 feature.
- [x] Remove ElevenLabs/TTS and LLM script enhancement UI/hooks/constants/store. Preserve independently useful script viewing/editing and ordinary audio import. Project JSON viewing/import/export remains; no independent script tool was coupled to the deleted TTS-only text/enhancement widgets.
- [x] Remove `GenerateShaderBox` and generation service/prompt/tests; remove its effect/fill/text entry points. Preserve shader registries, validators, renderers, saved project definitions, manual controls, and packages such as `fxpkg`. Saved content uses ordinary shader names rather than appended `(AI)` labels.
- [x] Simplify settings to supported preferences. Remove AI Editor, API Keys, and MCP tabs where now unused; remove service registry/provider defaults, favorites, caches, approval/dry-run settings, and their session-lock wiring. Retain project dimensions/frame rate/background and autosave/language preferences; remove the unused vault runtime, not stored user data.
- [x] Remove AI-only API transport/config and `apps/web/functions/api/proxy/[[catchall]].ts`; audit deployment configuration and ensure retired routes no longer forward requests. Do not delete unrelated service endpoints. Retain the sharing service URL in `config/api-endpoints.ts`, COOP/COEP headers and ordinary offline handling. Production preview returns SPA HTML for retired GET routes and 404 for POST, not provider responses; no deployment to a hosted environment was performed.
- [x] Delete `packages/agent`, `packages/agent-runner`, and `packages/creation-agent` once no retained consumer remains. Keep or remove `packages/creation-schema` according to actual deterministic consumers after extraction; document the result. Preserve `creation-core`, `creation-bindings`, and `core/creation`. Import audit found only removed agent consumers of `creation-schema`, so it was deleted too. Removed package dependencies/aliases and regenerated `bun.lock` with Bun 1.4.3; frozen install passes.

**Evidence:** [Phase 2 implementation and verification](ai-removal-phase2.md). The [first-three-checkbox record](ai-removal-phase2-first3.md) remains unchanged as historical intermediate evidence; its deferred Phase 2 items are now implemented. No storage cleanup or old-state migration was added.

**Exit met:** no chat/agent/external-generation/MCP runtime path remains, and retained manual editing, shader execution and creation features work without `@openreel/agent`. The Phase 2 evidence records its pre-Phase-3 boundary; on-device inference was removed in the next phase, below.

### Phase 3 — Remove on-device and browser AI

- [x] Delete Whisper workers/model definitions, automatic-caption panel, audio conversion helper if now unused, and multicam transcription acquisition. Keep transcript/caption schemas and caption import/export/editing. Whisper's worker/model catalog/converter are deleted; multicam acquisition remains absent. Neutral transcript segment/result types now live in `text/transcript-types.ts`.
- [x] Remove `speech-to-text-engine.ts` and its text barrel exports/callers, including browser SpeechRecognition declarations/entry points. Move any genuinely shared caption utilities before deletion. Removed the engine-store getter/state; independent subtitle parsing/export and transcript content types remain.
- [x] Remove MediaPipe background removal and behind-subject inspector controls, person-mask compositing and frame/cache lifecycle code in **both** `Preview.tsx` and `video-engine.ts`, and corresponding store actions/types. Do not add old-effect fallback markers or warnings. Also removed inference processing from `preview/canvas-renderers.ts`, background-removal task kinds and inference-only realtime render options/callers. Ordinary text effects, chroma key and manual masks remain.
- [x] Delete the ML engines/workers/protocols/temporal masks under `packages/core/src/ai/` after heuristic reframe extraction; remove the root AI barrel export. Heuristic reframing stays in `video/auto-reframe-engine.ts`; the AI directory and root export are deleted.
- [x] Verify Phase 1C removed the entire multicam feature, including face analysis, Silero imports/calls, deterministic analysis/sync/cut tools and `.orma`/OTIO workflows. Remove any remaining inference-only callers/dependencies, without reintroducing a deterministic multicam replacement. Preserve ordinary clip/track editing, not old multicam compatibility data. Phase 1C and new recursive absence checks pass; last-consumer audit permitted removing Transformers/MediaPipe and transitive ONNX packages with a Bun-generated lockfile.
- [x] Delete the mixed `AiTab` only after all retained utilities have a neutral home. Remove obsolete tab unions, inspector navigation targets, search entries, tours, tooltips, and any AI availability helper in `services/service-worker.ts`. Manual captions, DSP cleanup, energy highlights and beat-based editing retain their neutral sections. Removed AI-only offline handling from the public service worker while retaining static caching and generic network-only API behavior.

**Evidence:** [Phase 3 implementation and verification](ai-removal-phase3.md). All 25 phase/baseline source checks, workspace checks, real browser SRT/VTT import/editing, preview/title/intro-transition checks, saved-shader rendering and MP4 validation passed. No legacy effect readers, migrations, cleanup clients or data sweeps were introduced.

**Exit met:** retained preview/export/caption workflows have no model initialization, speech recognition, inference imports, or worker/model downloads; multicam authoring/analysis workflows are absent. Broader dependency/documentation audits and the release gate remain in Phases 4–5.

### Phase 4 — Dependency, build, and documentation cleanup

- [x] Remove `@huggingface/transformers` from web, `@mediapipe/tasks-vision` from web/core, `onnxruntime-web` from core, and removed workspace dependencies. Completed with the corresponding Phase 1C/2/3 last-consumer removals; the current lockfile has no inference or agent workspace packages.
- [ ] Remove retired package paths from root/web TypeScript, Vite, Vitest, package scripts, and any remaining package exports. Audit transitive AI-only UI dependencies (`react-markdown`, `remark-gfm`, syntax highlighting, etc.) with importer searches before removing them. Also prune dependencies/assets used only by the removed landing page, template browsers, screen recorder, tours or multicam feature; preserve packages shared with Recipes, ordinary animation, export or retained UI.
- [ ] Regenerate `bun.lock` with pinned Bun `1.4.3` during implementation; review workspace/transitive pruning and retain FFmpeg patches. Verify a subsequent `bun install --frozen-lockfile` succeeds. Do not hand-edit the lockfile or commit generated build outputs.
- [ ] Check tracked public assets, worker artifacts, preload/preconnect/CSP configuration, service-worker caches, environment documentation, deployment functions, and bundle chunks for retired AI resources. Preserve COOP/COEP and non-AI offline/media support.
- [ ] Add `scripts/check-no-ai.mjs` and a root check script using Node/Bun, modeled on `scripts/check-retired-cloud-gpu.mjs`. Check runtime source (including server functions and desktop remnants), manifests, forbidden packages/aliases/entry points, and known provider/model URLs. Exclude generated outputs/dependencies; narrowly allow historical test-fixture identifiers, not runtime legacy cleanup modules. Do not use a blanket substring ban on `ai`, `model`, `generated`, `mask`, or `shader`.
- [ ] Keep `check:retired-cloud-gpu` effective or preserve all of its guarantees in an explicitly tested replacement; removal must not revive previously stripped infrastructure.
- [ ] Update project `AGENTS.md`, `llm.txt` if relevant, active AI/agent guides, and affected editor/offline docs; retire active multicam feature guides rather than describing the removed workflow as supported. Leave `README.md` and `CONTRIBUTING.md` unchanged unless the user later authorizes edits. Mark historical `docs/superpowers` AI specs/plans as retired/superseded rather than rewriting history as current support. This plan is the removal reference.
- [ ] Existing `docs/ai-editing.md` mentions `scripts/verify-ai-workspace.cjs`, which is not present in the inspected scripts directory. Retire the stale instruction; do not depend on that missing script for acceptance.

**Exit:** a fresh install/build has no AI runtime packages or agent workspace dependencies, and current documentation describes the manual editor accurately.

### Phase 5 — Verification and release gate

- [ ] Replace AI success-path tests with absence/navigation and current-format editing coverage. Preserve tests for extracted manual transactions, sharing, creation synchronization, caption editing, and deterministic utilities.
- [ ] Exercise clean state and current-format save/reopen/recovery, including shaders, generic variable bindings, captions, media and creation scenes. Verify project/media persistence is untouched. No upgraded-state, credential cleanup or old-job/effect migration coverage is required.
- [ ] Verify default/current routes open the editor with no landing page or tour; recovery and editor-side new/open/recent-project flows work without replacing an already loaded project. Project/motion template browsing/application/saving and Screen recorder must have no reachable UI, startup client, modal or background permission request. Recipes and built-in/custom export presets must still work.
- [ ] Check ordinary title visibility, transitions, seeking and frame ownership/disposal consistently in preview and exported video. Removed effects must have no remaining mask/compositing initialization paths.
- [ ] Run browser smoke tests at wide and compact widths: import video/audio/images, edit/trim/split, text/captions, chroma key, transitions/effects, undo/redo, project save/reopen/relink/recovery, portable JSON/presets, motion/3D scene editing/sync, render queue, and actual local export.
- [ ] Verify multicam UI, agent tools, sync/cut/analysis workflows and worker entry points are absent. Verify current-format multi-track edits, transforms, track states and media references survive roundtrips and export.
- [ ] Capture requests and worker creation on boot, current-format project load, caption editing, motion editing, and export. Assert no retired provider/proxy/LLM request, inference runtime/model request, or AI worker is attempted. Use interception or request logging rather than inferring this from a working UI.
- [ ] Repeat core editing/export offline after app assets are available. A removed feature must not leave an invisible model-download fallback or blocking error.
- [ ] Inspect production bundles and retained workspace dependency graph, record before/after bundle sizes, and review the final diff for unrelated changes and generated outputs.

## Verification commands

Use repository scripts, not old pnpm instructions. These commands are for implementation, not evidence that they ran while writing this plan.

```sh
bun run typecheck
bun run test
bun run lint
bun run build
bun run check:retired-cloud-gpu
# Once added:
bun run check:no-ai
```

During individual phases, run focused checks first:

```sh
bun run --filter @openreel/web typecheck
bun run --filter @openreel/core typecheck
bun run --filter @openreel/web test:run src/path/to/changed.test.ts
bun run --filter @openreel/core test:run src/path/to/changed.test.ts
```

Use `apps/web/scripts/validate-browser-export.mjs` according to its own prerequisites for relevant export regression coverage. Add browser absence/current-format workflow checks in the existing JS/TS toolchain; do not assume Playwright is installed or silently add dependencies. Python is unavailable on this machine: do not use Python, pip, pytest, or `scripts/filters` Python utilities. Native creation backend tests require the existing CMake/C++20/Emscripten prerequisites if those backend sources are changed; this plan does not require rebuilding unrelated native code.

## Definition of done

- No AI functionality is reachable in web UI, settings, search, desktop remnants, headless workspace packages, or production proxy handlers.
- The app opens directly into the editor, with autosave/recovery safety intact and no landing page, skip switch or guided tours. Project/motion template features, screen recording and the entire Multi-Camera Editing feature are removed; Recipes, export presets, editor-side project access and ordinary current-format editing remain usable.
- No AI provider calls, speech recognition, model downloads, inference initialization, or AI worker creation occurs through retained current-format workflows.
- Agent packages and inference dependencies/aliases are removed; no new legacy compatibility layer is retained.
- Current-format project content remains editable/renderable. Old unfinished jobs, removed-effect fallbacks and prior-version migration are out of scope.
- Manual video/motion/3D editing, captions, non-ML utilities, portable sharing, persistence, undo/redo, preview, and local export pass regression checks.
- Build, typecheck, tests, relevant lint, absence checks, browser/network checks, and documentation review pass, or pre-existing unrelated failures are explicitly recorded rather than concealed.

## Highest-risk review points

1. Removing agent packages before extracting creation sync and portable editing would break retained manual functionality.
2. Segmentation is embedded in multiple preview/render branches; hiding inspector buttons is insufficient and can cause preview/export disagreement or invisible titles.
3. Blindly deleting “generated” content, the `ai/` directory, or all third-party services would remove non-AI functionality and user work.
4. Remove obsolete jobs/AI panels and their storage clients in the scheduled phases; do not add upgrade migrations or erase local assets as incidental cleanup.
5. Multicam removal must preserve generic multi-track editing, track visibility/audio controls, media references, preview/export and history. Remove multicam-only project types rather than retaining legacy engine imports or a no-VAD multicam workflow.
6. Removing `welcome/` wholesale would also remove recovery UI, while blindly removing “template” or “preset” code would break Recipes, export settings or existing motion-variable bindings. Separate those boundaries first.
