# Plan: strip AI and unwanted product features from the OpenReel fork

## Status and scope

- **Phase 0 completed with user authorization.** Historical baselines and fixtures are saved under `docs/ai-removal-phase0/` and remain unchanged.
- **Phase 1A implemented.** Startup/landing, project/motion template libraries, Screen recorder and both tours are removed. See [Phase 1A implementation and verification](ai-removal-phase1a.md). AI infrastructure remains for Phases 1B–5; those phases are still a plan.
- Repository inspected at commit `5da5cce`; working tree was clean before this plan was added.
- Confirmed with the user: **remove all AI**, including on-device inference, not just external providers.
- Additional confirmed removals: startup/landing page, all project templates, motion-composition templates, screen recorder, Editor tour, Animation & effects tour, and **all Multi-Camera Editing**, including deterministic/non-AI tools. **Keep Recipes and export presets.**
- After Phase 1A, the user repeated video import → trim start → video export and reported that it works. Multi-Camera Editing was then added to scope with authorization to update the plan only; its removal is pending in Phase 1C, not part of completed Phase 1A.
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
9. The entire Multi-Camera Editing feature: camera grouping/switching, sync/drift/bleed calibration, activity/reaction/transcript analysis, automatic/manual cut planning and review, multicam layout/social-clip generation, multicam-specific `.orma`/OTIO workflows, agent tools, worker/services, and engine/catalog exports. Remove implementations, not just the inspector panel. Keep already materialized timeline edits as ordinary clips/tracks and preserve source media; retain only narrowly scoped inert compatibility readers/types where necessary.

### Preserve

- Import/relink, media library, timeline editing, undo/redo, autosave/recovery, playback, proxies, effects, transitions, keyframes, local export, and project packaging. Retain new/open/save/recent-project access within the editor despite removing the landing page.
- **Recipes:** the clip-scoped editing-template system under `packages/core/src/editing-templates`, including its browser, adjustable controls, and applied content.
- **Export presets:** built-in/custom encoding, resolution, quality, and platform settings. These are separate from project templates; `apps/web/src/services/export-presets.ts` stays.
- Existing projects/compositions made from templates, their text/shapes/media/keyframes, and generic motion variable bindings/manual animation tools. Removing starter templates is not removing their instantiated content.
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
| Settings and transport | `components/editor/settings/`, `stores/settings-store.ts`, `services/{api-proxy,secure-storage}.ts`, `config/api-endpoints.ts`, `functions/api/proxy/[[catchall]].ts` | Remove AI registrations, UI, and production handlers. Secure storage currently serves AI credentials; preserve narrowly scoped legacy cleanup without retaining the vault UI/runtime. |
| Local transcription | `workers/whisper-{worker,models}.ts`, `utils/whisper-audio.ts`, `inspector/AutoCaptionPanel.tsx`, `services/multicam-transcription.ts`, `packages/core/src/text/speech-to-text-engine.ts` | Delete recognition engines and callers, retaining caption data/import/editor primitives. |
| Person segmentation | `packages/core/src/ai/`, `inspector/{BackgroundRemovalSection,BehindSubjectSection}.tsx`, `Preview.tsx`, `packages/core/src/video/video-engine.ts` | Remove inference in both preview and render/export paths, not only inspector UI. Handle old `behindSubject` values safely. |
| Multi-Camera Editing (entire feature) | `inspector/{MultiCameraPanel.tsx,multicam-workflow.ts}`, `InspectorPanel.tsx`, `AIGenTab.tsx`, `services/multicam-*.ts`, `workers/multicam-analysis-worker.ts`, `services/agent/multicam-bridge.ts`, `packages/core/src/{multicam/,video/multicam-engine.ts,actions/handlers/multicam.ts}`, agent multicam tools/contracts | Remove both ML and deterministic multicam authoring/analysis workflows in Phase 1C. Audit action registration, `engine-store.ts`, capability/barrel exports, and persisted `Project.multicamGroups` imports before deleting engine code. Preserve ordinary output clips/tracks/transforms and source media; isolate any necessary inert compatibility types from executable engines. |
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

## Compatibility and data policy

Implement and test this policy before deleting old readers/state handlers:

1. **Completed content stays usable.** Preserve local blobs/file handles, media IDs, clips, creation/motion scenes, supplied transcripts, caption text/timing, and saved shader definitions. Do not reject content based on AI provenance or delete `project.generatedShaders` simply because of its name.
2. **Pending jobs become offline placeholders.** Old `isPending`, `kieaiTaskId`, and `kieaiError` metadata must not start polling or fetching. Preserve media IDs/references and any valid local asset. For unfinished assets without local media, present the ordinary missing-media/relink state with a concise retirement explanation; no retry-generation button or infinite spinner.
3. **Removed live effects never initialize a model.** Old `behindSubject` state renders text normally, with an explicit unsupported-effect warning when relevant. Apply the same documented fallback to any persisted segmentation settings discovered during implementation. Do not claim identical visuals when the removed effect cannot be reproduced. Warn on project load/export as appropriate without silently destructively rewriting the original file.
4. **Retired UI state cannot strand the editor.** Migrate AI/template tabs, multicam section/navigation targets, settings tabs, chat panel visibility/width, inspector section targets, recorder modals, and desktop chat layouts to valid manual defaults. Ignore/drop `skipWelcomeScreen` regardless of whether its old value is true or false. Old welcome/templates/recent links must reach a valid editor path rather than a removed page. Whitelist retained settings rather than spreading obsolete persisted fields back into state.
5. **Cleanup is narrow and idempotent.** Remove known retired localStorage records (`openreel-ai-chat-history`, `kieai-pending-tasks`), prune AI fields from `openreel-settings` and `openreel-ui-preferences`, and remove known AI credential records in `openreel-secure` without decrypting them. Audit actual keys/record IDs before implementation. Never clear all localStorage, all IndexedDB, project/media databases, file handles, or the multicam `.orma` store. The retired `openreel-multicam-analysis` database (`orma-artifacts` store) stays dormant by default; do not initialize or delete it as incidental startup cleanup.
6. **No startup resurrection.** Run cleanup without importing old Zustand stores, provider clients, workers, or pollers. Leave only a minimal legacy cleanup/compatibility module and tests where necessary. Handle blocked/unavailable storage without blocking the editor or producing unhandled rejections. Unknown secret records must not be deleted indiscriminately.
7. **Cached models are not project assets.** Identify app-owned inference cache names/entries before deleting any. Do not purge unrelated origin caches or unregister offline support wholesale. The upgraded build must not request models even if an old model cache remains.
8. Keep import validation and project capability/version safeguards. Any legacy fields retained solely for reading must remain inert, narrowly documented, and covered by tests.
9. **Template-authored and recorded content remains content.** Existing instantiated template scenes/projects and recorded audio/video must still open, edit, save, and export. Keep shared variables/bindings/types if retained projects or Recipes need them. Retiring a template library does not authorize deleting user projects, Recipes, custom export presets (`openreel-custom-export-presets`), or media.
10. **Direct startup is not a recovery bypass.** Preserve `useProjectRecovery`, autosave detection and recovery/dismissal before creating a fresh project. With no recovery/open project, create a normal blank project using current defaults (1920×1080, 30 fps) and open the editor. Keep explicit new-project dimension/frame-rate routes and independent shared-video routes working. Do not create duplicate projects or overwrite restored state during navigation/reload.
11. Retired tour keys (`openreel-onboarding-complete`, `openreel-mograph-tour-complete`) may be narrowly removed or left inert; neither may start a tour. The project-template database `openreel-templates` is separate from project/media storage: leave old user template records dormant by default rather than deleting data as an incidental UI cleanup. Do not initialize its engine or cloud client on startup.
12. **Multicam-authored edits remain content.** Preserve materialized output clips/tracks, timing, transforms/layout keyframes, media references, and existing source-track hidden/muted/solo states through open/save/undo/redo/export. Do not regenerate cuts, unhide duplicate source footage, or discard user media when retiring group tools. Preserve legacy group/analysis metadata inertly when needed for non-destructive roundtrips; relocate compatibility types out of the executable engine. Standalone `.orma` files and old analysis records remain user data, but retaining them does not retain an analysis browser/import/export feature. Audit any saved construct requiring live multicam rendering and define/test an honest non-destructive fallback or conversion before removing its reader; do not claim identical visuals without verification.

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

### Phase 1B — Rescue retained non-AI functionality and add AI compatibility

- [ ] Extract the generic transaction/commit, stale-state checks, engine synchronization, history, relinking, and serialization behavior needed by portable edit/preset operations from `services/agent`. Use a neutral editing service, not an agent host adapter.
- [ ] Move `EditSharingPanel` to an ordinary project/share UI. Remove chat resets and implement preset application through validated local editing actions, preserving atomic one-step undo/redo and failure rollback.
- [ ] Extract deterministic creation-to-motion synchronization from the agent executor/live host into the creation/project editing layer. Wire `CreationWorkspacePanel` directly to that operation, preserving mutation serialization, error handling, IDs, history, and preview synchronization.
- [ ] Move model-inspection types/helpers only if a retained manual consumer needs them; otherwise remove the agent-only inspection feature. Do not retain agent “suggested next tools” as a dependency of manual 3D rendering.
- [ ] Move heuristic reframing to a neutral video/editing module and update exports/imports/tests. Separate real behavior from misleading model-loading messages.
- [ ] Relocate SRT/VTT import and `CaptionEditorPanel` to text/caption UI; beat sync and energy highlights to neutral editing/audio UI; DSP cleanup and auto-color to audio/color controls; chroma key to effects.
- [ ] Add the legacy project/UI/settings normalization and startup cleanup described above, including tests for repeated startup and unavailable storage. Ensure pending jobs cannot resume during migration.

**Exit:** retained manual features have no dependency on an AI request/tool loop; legacy fixtures load without inference/network calls.

### Phase 1C — Remove all Multi-Camera Editing (newly requested; not implemented)

This scope addition follows completed Phase 1A and is separate from rescuing retained manual utilities in Phase 1B. Remove multicam even where it is deterministic/non-AI. Complete this before deleting agent infrastructure; do not carry forward the old requirement to keep deterministic multicam usable.

- [ ] Add fixtures/tests for multicam-authored projects: materialized cuts and multi-panel layouts, transform/layout keyframes, source-track visibility/audio states, media references, legacy group metadata and dormant `.orma` artifacts. Establish open/save/undo/redo/preview/export behavior before deleting readers or engines.
- [ ] Remove the `Multi-Camera Editing` inspector section, `MultiCameraPanel`, `multicam-workflow`, AI-tools submenu entry, search/navigation targets and any desktop entry points. Normalize retired section/tab targets to supported manual defaults. Preserve ordinary editing of multiple video tracks, clip transforms, grouping and audio controls outside the multicam feature.
- [ ] Remove camera-group authoring, sync/drift/bleed calibration, activity/face/transcript acquisition, Silero VAD, cut planning/review/overrides, multicam layout/social-clip generation, `.orma`/OTIO feature workflows, `services/multicam-*` and `workers/multicam-analysis-worker.ts`. Audit imports and rescue only genuinely shared ordinary-media/audio helpers; do not replace removed analysis with another backend.
- [ ] Remove multicam agent tools, `services/agent/multicam-bridge.ts`, host contracts/implementations, discovery/prompt references and related feature-success tests together so the remaining agent packages typecheck until Phase 2.
- [ ] Remove executable `packages/core/src/multicam/`, `video/multicam-engine.ts`, multicam action handlers/registrations, `engine-store.ts` state/getters and feature exports once compatibility callers are disentangled. Audit `multicam/setAll`, `multicam/applyEdit`, `multicam/restoreEdit` and persisted history handling; retain only tested inert data definitions or narrow legacy action translation where necessary to preserve ordinary edits/history, not a callable multicam toolset.
- [ ] Keep old `openreel-multicam-analysis` / `orma-artifacts` records dormant; remove the feature's runtime storage client without clearing user records. Retained projects must not initialize that database, an analysis worker, model or multicam engine. Preserve inert legacy group metadata without pulling executable engine code into project types/serialization.
- [ ] Replace multicam feature-success tests with UI/source absence, retired-target normalization, dormant-storage and existing-content compatibility tests. Verify no multicam worker/model/network request on startup, project load, preview or export and that generic multi-track editing still works. Repeat import video → trim start → export video.
- [ ] Run focused web/core/remaining-agent tests and typechecks, then normal workspace checks/build. Record multicam removal separately from Phase 0 and Phase 1A evidence; remove its exclusively used dependencies/assets only after importer audits, without touching shared codecs/audio/rendering packages.

**Exit:** no multicam authoring, analysis, sync/cut workflow, `.orma`/OTIO feature UI or agent control surface remains. Old materialized edits remain ordinary editable/renderable content; any necessary compatibility metadata is inert and old analysis storage stays dormant.

### Phase 2 — Remove chat, agents, and generative services

- [ ] Remove chat from toolbar, action rail, search, compact panel switcher, editor grid/resizers, default panel state, and desktop source layouts. Audit `ai-workspace.css` before deleting it: preserve any shared manual layout rules under neutral names.
- [ ] Delete chat components/stores/session connection state and agent-only web services after Phase 1 consumers are detached. Remove MCP listener installation and AI-only bridge contracts/mocks/settings.
- [ ] Remove AI generation tabs/dialogs/forms, the Kie.ai startup poller in `App.tsx`, provider clients, upload/download helpers, task store, pending/retry media actions, and AI-only processing task types.
- [ ] Remove ElevenLabs/TTS and LLM script enhancement UI/hooks/constants/store. Preserve independently useful script viewing/editing and ordinary audio import.
- [ ] Remove `GenerateShaderBox` and generation service/prompt/tests; remove its effect/fill/text entry points. Preserve shader registries, validators, renderers, saved project definitions, manual controls, and packages such as `fxpkg`.
- [ ] Simplify settings to supported preferences. Remove AI Editor, API Keys, and MCP tabs where now unused; remove service registry/provider defaults, favorites, caches, approval/dry-run settings, and their session-lock wiring.
- [ ] Remove AI-only API transport/config and `apps/web/functions/api/proxy/[[catchall]].ts`; audit deployment configuration and ensure retired routes no longer forward requests. Do not delete unrelated service endpoints.
- [ ] Delete `packages/agent`, `packages/agent-runner`, and `packages/creation-agent` once no retained consumer remains. Keep or remove `packages/creation-schema` according to actual deterministic consumers after extraction; document the result. Preserve `creation-core`, `creation-bindings`, and `core/creation`.

**Exit:** no chat/agent/generation/MCP runtime path remains, and all preserved manual features work without `@openreel/agent`.

### Phase 3 — Remove on-device and browser AI

- [ ] Delete Whisper workers/model definitions, automatic-caption panel, audio conversion helper if now unused, and multicam transcription acquisition. Keep transcript/caption schemas and caption import/export/editing.
- [ ] Remove `speech-to-text-engine.ts` and its text barrel exports/callers, including browser SpeechRecognition declarations/entry points. Move any genuinely shared caption utilities before deletion.
- [ ] Remove MediaPipe background removal and behind-subject inspector controls, person-mask compositing and frame/cache lifecycle code in **both** `Preview.tsx` and `video-engine.ts`, and corresponding store actions/types no longer needed for compatibility.
- [ ] Delete the ML engines/workers/protocols/temporal masks under `packages/core/src/ai/` after heuristic reframe extraction; remove the root AI barrel export.
- [ ] Verify Phase 1C removed the entire multicam feature, including face analysis, Silero imports/calls, deterministic analysis/sync/cut tools and `.orma`/OTIO workflows. Remove any remaining inference-only callers/dependencies, without reintroducing a deterministic multicam replacement. Preserve only ordinary materialized clips/tracks and documented inert compatibility data.
- [ ] Delete the mixed `AiTab` only after all retained utilities have a neutral home. Remove obsolete tab unions, inspector navigation targets, search entries, tours, tooltips, and any AI availability helper in `services/service-worker.ts`.

**Exit:** retained preview/export/caption workflows have no model initialization, speech recognition, inference imports, or worker/model downloads; multicam authoring/analysis workflows are absent.

### Phase 4 — Dependency, build, and documentation cleanup

- [ ] Remove `@huggingface/transformers` from web, `@mediapipe/tasks-vision` from web/core, `onnxruntime-web` from core, and removed workspace dependencies.
- [ ] Remove retired package paths from root/web TypeScript, Vite, Vitest, package scripts, and any remaining package exports. Audit transitive AI-only UI dependencies (`react-markdown`, `remark-gfm`, syntax highlighting, etc.) with importer searches before removing them. Also prune dependencies/assets used only by the removed landing page, template browsers, screen recorder, tours or multicam feature; preserve packages shared with Recipes, ordinary animation, export or retained UI.
- [ ] Regenerate `bun.lock` with pinned Bun `1.4.3` during implementation; review workspace/transitive pruning and retain FFmpeg patches. Verify a subsequent `bun install --frozen-lockfile` succeeds. Do not hand-edit the lockfile or commit generated build outputs.
- [ ] Check tracked public assets, worker artifacts, preload/preconnect/CSP configuration, service-worker caches, environment documentation, deployment functions, and bundle chunks for retired AI resources. Preserve COOP/COEP and non-AI offline/media support.
- [ ] Add `scripts/check-no-ai.mjs` and a root check script using Node/Bun, modeled on `scripts/check-retired-cloud-gpu.mjs`. Check runtime source (including server functions and desktop remnants), manifests, forbidden packages/aliases/entry points, and known provider/model URLs. Exclude generated outputs/dependencies; narrowly allow documented compatibility fixtures/cleanup identifiers. Do not use a blanket substring ban on `ai`, `model`, `generated`, `mask`, or `shader`.
- [ ] Keep `check:retired-cloud-gpu` effective or preserve all of its guarantees in an explicitly tested replacement; removal must not revive previously stripped infrastructure.
- [ ] Update project `AGENTS.md`, `llm.txt` if relevant, active AI/agent guides, and affected editor/offline docs; retire active multicam feature guides rather than describing the removed workflow as supported. Leave `README.md` and `CONTRIBUTING.md` unchanged unless the user later authorizes edits. Mark historical `docs/superpowers` AI specs/plans as retired/superseded rather than rewriting history as current support. This plan is the removal reference.
- [ ] Existing `docs/ai-editing.md` mentions `scripts/verify-ai-workspace.cjs`, which is not present in the inspected scripts directory. Retire the stale instruction; do not depend on that missing script for acceptance.

**Exit:** a fresh install/build has no AI runtime packages or agent workspace dependencies, and current documentation describes the manual editor accurately.

### Phase 5 — Verification and release gate

- [ ] Replace AI success-path tests with absence/navigation/legacy-compatibility coverage. Preserve tests for extracted manual transactions, sharing, creation synchronization, caption editing, and deterministic utilities.
- [ ] Exercise clean state and upgraded state, including old settings/UI keys, both skip-startup preference values, removed template tabs/links, multicam targets/groups/output tracks and dormant `.orma` data, tour keys, chat history, encrypted AI records, unfinished jobs, saved shader definitions, template-authored variable bindings, recorded media, and creation scenes. Verify cleanup is idempotent and project/media persistence is untouched.
- [ ] Verify default/legacy URLs open the editor with no landing page or tour; recovery and editor-side new/open/recent-project flows work without replacing an already loaded project. Project/motion template browsing/application/saving and Screen recorder must have no reachable UI, startup client, modal or background permission request. Recipes and built-in/custom export presets must still work.
- [ ] Verify unsupported live-effect warnings/fallbacks match in preview and exported video. Check title visibility, transitions, seeking, frame ownership/disposal, and no stale mask state.
- [ ] Run browser smoke tests at wide and compact widths: import video/audio/images, edit/trim/split, text/captions, chroma key, transitions/effects, undo/redo, project save/reopen/relink/recovery, portable JSON/presets, motion/3D scene editing/sync, render queue, and actual local export.
- [ ] Verify multicam UI, agent tools, sync/cut/analysis workflows and worker entry points are absent. Open legacy multicam-authored projects and verify ordinary clip/track edits, layout transforms, source-track states and media references survive roundtrips and export; dormant analysis storage is untouched.
- [ ] Capture requests and worker creation on boot, project load (including legacy multicam projects), caption editing, motion editing, and export. Assert no retired provider/proxy/LLM request, inference runtime/model request, or AI worker is attempted. Use interception or request logging rather than inferring this from a working UI.
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

Use `apps/web/scripts/validate-browser-export.mjs` according to its own prerequisites for relevant export regression coverage. Add browser absence/upgrade checks in the existing JS/TS toolchain; do not assume Playwright is installed or silently add dependencies. Python is unavailable on this machine: do not use Python, pip, pytest, or `scripts/filters` Python utilities. Native creation backend tests require the existing CMake/C++20/Emscripten prerequisites if those backend sources are changed; this plan does not require rebuilding unrelated native code.

## Definition of done

- No AI functionality is reachable in web UI, settings, search, desktop remnants, headless workspace packages, or production proxy handlers.
- The app opens directly into the editor, with autosave/recovery safety intact and no landing page, skip switch or guided tours. Project/motion template features, screen recording and the entire Multi-Camera Editing feature are removed; Recipes, export presets, editor-side project access and pre-existing content remain usable.
- No AI provider calls, speech recognition, model downloads, inference initialization, or AI worker creation occurs through retained workflows, including legacy project loading.
- Agent packages and inference dependencies/aliases are removed; any retained compatibility strings/types are inert, documented, and tested.
- Completed project content remains editable/renderable; unfinished generations use local relinking, and removed live effects have honest, non-destructive fallback warnings.
- Manual video/motion/3D editing, captions, non-ML utilities, portable sharing, persistence, undo/redo, preview, and local export pass regression checks.
- Build, typecheck, tests, relevant lint, absence checks, browser/network checks, and documentation review pass, or pre-existing unrelated failures are explicitly recorded rather than concealed.

## Highest-risk review points

1. Removing agent packages before extracting creation sync and portable editing would break retained manual functionality.
2. Segmentation is embedded in multiple preview/render branches; hiding inspector buttons is insufficient and can cause preview/export disagreement or invisible titles.
3. Blindly deleting “generated” content, the `ai/` directory, or all third-party services would remove non-AI functionality and user work.
4. Persistence migration must not rehydrate obsolete jobs/AI panels, erase local assets, or fetch former provider URLs.
5. Multicam removal must not delete or regenerate materialized edits, change source-track visibility/audio states, lose media references, or import executable engines through legacy project types. Keep old `.orma` records dormant; verify ordinary preview/export and history compatibility rather than preserving a no-VAD multicam workflow.
6. Removing `welcome/` wholesale would also remove recovery UI, while blindly removing “template” or “preset” code would break Recipes, export settings or existing motion-variable bindings. Separate those boundaries first.
