# AI removal: Phase 1B implementation

Phase 1B rescues retained manual features, following [Phase 1A](ai-removal-phase1a.md). It does **not** remove multicam (Phase 1C), the remaining agent workspaces, providers or inference runtimes. This is not a claim that the application is already AI-free.

## Scope correction: no older-project compatibility

After the initial implementation, the user confirmed there are no older projects to migrate and explicitly requested removal of the legacy compatibility work. The current scope therefore excludes old-project/state migration, retirement placeholders, removed-effect fallbacks/warnings and startup storage/credential cleanup.

Removed the Phase 1B additions:

- `services/legacy-cleanup.ts`, core `editing/legacy-compatibility.ts` and their dedicated tests.
- The legacy poller and project-store integration tests, startup cleanup gate and cleanup-driven lazy loading of the web app.
- Generation-retirement and behind-subject intent fields, load/recovery/export warnings, asset retirement notices and serialization/media-recovery normalizers.
- Settings/UI upgrade resets and the session-only Kie persistence override. Task persistence has its pre-Phase-1B behavior until task/poller removal in Phase 2. General settings still persist supported manual preferences directly, without a migration helper.

The plan now drops backward-compatibility requirements for subsequent phases, including old multicam metadata and `.orma` readers. This does not authorize clearing storage or deleting ordinary editing primitives. Phase 0 fixtures/evidence, Phase 1A's historical record/behavior, normal current-format validation, autosave/recovery, media storage and generic missing-media relinking remain intact. Historical fixtures can still serve as sample data for retained scene editing tests without requiring a legacy reader.

## Retained manual editing separation

- `apps/web/src/services/editing/` owns isolated draft transactions, revision checks, the shared mutation queue, validated portable edit/preset application, local-media relinking and transition validation. Remaining agent entry points are temporary adapters; manual operations do not import them or reset chat state.
- Snapshot commits validate a detached candidate and synchronize overlay/effect/transition/shader engines before publishing project state or adding history. Failed synchronization attempts restore prior engines without publishing the draft or destroying redo. Revision checks include local Blob/file-handle identity; changes during asynchronous engine synchronization are rejected rather than overwriting intervening edits.
- `EditSharingPanel.tsx` moved out of chat into **Project files & backups** (`ProjectPackageDialog.tsx`). Presets use validated local actions, fresh effect IDs and a single undo/redo step. Package/sharing busy states prevent competing dialog operations. Portable-format limitations and validation remain: unsupported scenes/shapes/shaders require the ordinary project/package format rather than silently losing content.
- `packages/core/src/creation/creation-to-motion.ts` supplies deterministic semantic-scene conversion. `services/editing/creation-sync.ts` synchronizes through local draft actions, preserving binding/composition/layer/render-object IDs and repairing missing bound layers without duplicate compositions. `CreationWorkspacePanel` calls this service directly, not the tool executor/live host. Remaining agent tools stay in their package until their planned removal.
- No retained manual consumer needed `motion/model-inspection.ts`. Removed that browser helper, the live-host method, `inspect_3d_model` tool, its dedicated contracts and prompt/discovery references. Manual GLB/glTF rendering, scene editing, embedded animation and the separate remaining rigging tools were not removed.
- Heuristic reframing moved from core `ai/` to `video/`, with corrected initialization copy and exports. It uses local pixel/skin-region heuristics with a centered fallback, not a model. Frame-index caches reset between analyses; platform/aspect-ratio presets remain.
- Manual SRT/VTT import and caption editing are independently available in the inspector. Beat-sync edits, energy highlights and DSP dialogue cleanup have neutral audio sections; auto-color is under color controls and heuristic reframing is separate. Search/quick-caption navigation targets manual controls. Chroma-key controls remain in Effects. The AI tab now contains only the still-pending-removal automatic caption recognition feature.

## Verification

The initial implementation passed all checks with 436 test files / 3,115 passing tests and 27 existing skips. That result included the subsequently removed compatibility tests and is historical, not the current test count.

Current checks after the scope correction:

```sh
bun run typecheck
bun run test
bun run lint
bun run build
bun run check:retired-cloud-gpu
node --test scripts/ai-removal-phase1a.test.mjs scripts/ai-removal-phase1b.test.mjs
```

All checks passed after the scope correction:

- All 9 workspace typechecks passed.
- **432 test files passed; 3,104 tests passed; 27 existing skips remain.** The old-state hydration assertions were also removed from the historical browser-fixture test; fixture data itself is unchanged.
- Lint: **0 errors, 107 warnings**. Production build passed; existing Vite mixed-import/large-chunk and jsdom WebGL2 diagnostics remain.
- Retired-cloud-GPU check passed over 1,279 scanned source files. Phase 1A/1B source guards passed all 5 remaining checks.

Retained regression coverage includes:

- Atomic preset effect/transition application, disabled effects and fresh IDs; one-step undo/redo; partial failure and preserved redo; portable import with Blob identity; local-media relinking and short-source rejection; stale drafts, file handles and asynchronous synchronization races; failed engine synchronization; and mutation-queue release.
- Actual local creation sync, binding/ID preservation, missing-layer repair, rollback after a later action fails, undo/redo, semantic object/camera keyframes and retained manual layer properties. UI tests forbid agent imports and verify the direct service call.
- Synthetic-pixel heuristic reframing with network/inference workers forbidden; current general-settings persistence; retained Recipes, export presets, project packages, history and Phase 1A workflows.
- Phase 1A/1B source guards covering removed product surfaces, manual editing independence, neutral reframing and removed agent-only inspection. The legacy-cleanup guard was removed with its implementation.

Raw evidence stays in ignored `phase1b-*.log` files; the scope-correction checks use `phase1b-no-legacy-*.log`. `README.md`, `CONTRIBUTING.md`, the lockfile, Phase 0 evidence and generated build artifacts are unchanged.

## Verification limits / next phase

No real-browser HAR, GPU preview comparison or independently inspected exported file was captured in Phase 1B. The user-reported import → trim → export smoke test in Phase 1A is historical, not a new Phase 1B run. Repeat that flow and check Project files & backups, manual captions and creation sync in the browser before release.

Phase 1C remains a plan only. Remaining chat/AI entry points, task polling, native bridge remnants and inference dependencies are intentionally still present for later phases; those AI features can still request the network. The absence claims here apply to retained manual operations, not the whole application. No old-version migration or legacy compatibility guarantees are required.
