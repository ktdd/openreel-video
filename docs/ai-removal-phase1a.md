# AI removal: Phase 1A implementation

Implemented 2026-11-04. This records **additional product-feature removal**, separately from the unchanged [Phase 0 baseline](ai-removal-phase0/baseline.md). AI chat, providers, inference and their dependencies remain for subsequent phases; this is not an AI-absence claim.

## Changes

- Default, empty, unknown and legacy welcome/templates/recent routes open editing directly. Both old skip-startup values are ignored and removed from persisted UI preferences. No landing component remains.
- Recovery UI moved from `components/welcome/` to `components/editor/`. Startup waits for recovery checking and accept/dismiss/failure before creating a project. Blank defaults remain 1920×1080 at 30 fps; explicit dimension/preset/frame-rate links still work. Existing projects are not replaced by fallback navigation. StrictMode startup and later explicit new-project navigation do not duplicate creation. Shared-video pages do not create an editor project or display recovery over the shared video.
- Editor-side `ProjectSwitcher`, project backups/files, saving, recent autosaves and project settings remain. The action-rail home link is removed.
- Removed full-project template browsers, save/import/apply/publish paths, cloud client, template engine/catalog and exports. Also removed the separate unused starter catalog/template methods in `services/project-manager.ts`. Platform dimensions/settings were extracted from `types/scriptable-template.ts` into `types/project-presets.ts`; they are not scene templates.
- Removed motion starter browser/tab/catalog/preset-based composition creation and capability entries. Retired the agent's `apply_motion_template` tool and prompt references while keeping remaining agent workspaces typecheckable. New manual motion compositions are genuinely blank at project dimensions. Existing scene data and generic variables/bindings remain. Recipe-owned motion-template metadata types and single-layer presets remain.
- Removed the Screen recorder, its screen/webcam result imports, countdown, controls, service, store and entry points. The independent audio-only voice-over tool is not the bundled Screen recorder and remains. Previously recorded files stay ordinary media.
- Removed both tours, launch actions, first-run hooks, overlays, timers/listeners and tour-only DOM attributes. The timeline attribute also used by keyboard routing was renamed to `data-editor-panel`; keyboard behavior is covered by its existing tests.
- UI persistence now whitelists supported preferences, drops obsolete startup/modal fields and normalizes retired template inspector targets. No template database is initialized or deleted by startup. Old tour keys are left inert; old `openreel-templates` records are left dormant. No project/media/credential databases, Recipes or export presets are deleted or migrated by this phase.

## Verification

All commands below passed:

```sh
bun run typecheck
bun run test
bun run build
bun run lint
bun run check:retired-cloud-gpu
node --test scripts/ai-removal-phase1a.test.mjs
```

- Workspace typechecks: all 9 passed.
- Workspace tests: 428 files passed; 3,095 tests passed and the existing 27 skipped tests remain across core, web, agent, agent-runner, creation-agent, creation-bindings, creation-schema and fxpkg.
- Lint: 0 errors, 108 warnings (Phase 0 recorded 109). Existing jsdom WebGL2 diagnostics and Vite mixed-import/large-chunk warnings remain; these are not actual GPU/export verification.
- Added startup/router/recovery and legacy-preference coverage, including clean storage, both skip values, old URLs, existing projects, explicit settings, StrictMode and recovery rejection. Recovery-dialog and project-switcher tests remain after the move.
- Added actual Assets/action-rail absence tests: import and Recipes remain; no template/record action, home or tour launch exists. With capture APIs and fetch spied, these mounted surfaces make no capture request or network call and do not read first-run tour keys after timers advance. Motion-shell tests verify Kits is absent and animation controls remain.
- Added blank-composition, project-manager blank-project, instantiated template text/keyframe/variable-binding JSON roundtrip, recorded-media JSON/local-blob persistence and built-in/custom export-preset coverage. Existing Recipe apply/update/remove and project save/package tests passed unchanged.
- Added `scripts/ai-removal-phase1a.test.mjs`: three source/implementation absence checks, covering web/server/desktop-containing source, core and the remaining agent runtime. It checks exact retired identifiers and removed implementations rather than banning generic template/preset/recording terms.

Local raw logs are ignored `phase1a-*.log` files. No lockfile/dependency changes or generated build outputs are included. `README.md`, `CONTRIBUTING.md` and Phase 0 evidence are unchanged.

## User-reported browser smoke test

After Phase 1A, the user repeated the earlier flow: **import video → trim start → export video**, and reported that it works. This is user-reported functional verification; no new HAR or exported file was supplied for independent inspection.

During that run the user identified Multi-Camera Editing as another unwanted feature. Full multicam removal is now planned in [Phase 1C](remove-ai-features.md#phase-1c--remove-all-multi-camera-editing-newly-requested-not-implemented), including deterministic tools. It was not removed in Phase 1A; the follow-up authorization is for a plan update only.

## Remaining verification limits

No automated real-browser capture or independent GPU preview/render/exported-video inspection was run in this phase. No Playwright/Puppeteer dependency was added. The request/capture assertions above are jsdom/component and source-absence checks, not a new HAR. The successful user smoke test covers the basic import/trim/export path; wider/compact layouts, broader workflows, request capture and independent export inspection remain release-gate work. No native creation backend source changed or required rebuilding.
