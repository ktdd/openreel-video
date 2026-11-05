# AI and unwanted-feature removal — completed scope

The agreed removal work is complete. This document records the retained boundaries and verification limits, not a pending implementation plan or comprehensive browser-reliability sign-off.

Detailed phase reports, pre-removal network/import/bundle baselines and one-off phase scripts have been removed from the checkout. Their tracked versions remain available in Git history. Current source, tests, [manual editor workflows](editor-workflows.md), [offline/media-hosting guidance](OFFLINE.md) and `AGENTS.md` are the development references.

## Removed

- Chat, conversation/job state, agent workspaces/runners, MCP editing and model discovery.
- External image/video/voice/script generation, AI shader authoring, provider/API-key settings, credential clients and production AI proxy routes.
- Whisper and browser speech recognition, automatic transcription acquisition, person/background segmentation and text-behind-subject inference in both preview and export. Inference dependencies, model catalogs/download paths and AI workers are absent.
- Startup/landing and project/motion-composition template browsers, the Screen recorder and both guided tours. The app opens directly into editing, subject to normal loading/recovery safeguards.
- The entire Multi-Camera Editing feature, including deterministic sync, drift analysis, cut planning, camera grouping and its specialized import/export workflows. Ordinary multi-track editing is separate and remains.
- Desktop renderer UI, IPC/native-sidecar adapters and desktop build modes. This does not remove deterministic native creation backends.

Separately requested cleanup also removed PostHog analytics, Wrangler app deployment tooling, unused vendored font files and the procedural music/SFX library. Hosted share-viewer routes redirect to the editor. These were independent product choices, not evidence that every removed feature was AI.

## Preserve

- Ordinary video/audio/image import, original-media relinking, media storage, timeline editing, transforms/keyframes, effects/transitions, proxies, playback and local export.
- Current-format project save/open, autosave/recovery, project packaging, undo/redo, editor-side project access and ordinary missing-media handling.
- **Recipes** under `packages/core/src/editing-templates` and built-in/custom **export presets**. These are not the removed full-project or whole-composition templates.
- Manual titles/captions, SRT/VTT import/export and existing caption text/timing/word metadata, regardless of how the text was originally produced.
- Completed generated media and saved shader definitions as ordinary content. Keep GLSL/WGSL validation, registries, rendering, parameters/keyframes and effect packages; content provenance is not an executable AI feature.
- Deterministic creation/motion/3D engines, generic variable bindings and native/WASM/TypeScript CPU creation backends. The standalone Motion Design workspace remains disabled and is not mounted by the browser entry; retained engine code does not imply that its complete authoring UI is enabled or release-ready. Do not enable/integrate it as incidental cleanup.
- Chroma key/manual masks, beat/energy-based editing, DSP audio cleanup, auto-color, stabilization, non-neural resizing/upscaling and heuristic reframing. Normal audio import, editing, mixing, recording and export remain independent of the deleted sound library.
- Portable edit JSON/presets, local-media relinking and deterministic creation synchronization under `apps/web/src/services/editing`, independent of agent infrastructure.

## Architectural and data-safety boundaries

- Remove unwanted implementations, not merely their buttons. Do not reintroduce a hidden provider, inference fallback, agent tool loop or dormant desktop entry point.
- No older-project compatibility requirement exists. Do not add legacy readers, retirement placeholders, removed-effect fallbacks, old-job recovery or storage/credential migrations and sweeps. Preserve normal current-format validation and capability safeguards.
- Do not clear user projects, media, localStorage/IndexedDB or origin caches as removal cleanup. Deleting an unused storage client is not authorization to delete its stored data.
- Retained editing transactions must preserve atomic history, rollback, revision checks, media identity and creation bindings. AI-package deletion must not become a dependency of manual editing.
- Preview and export must retain ordinary title/effect rendering and frame ownership/disposal without initializing removed inference paths.
- Local-first does not mean no networking: ordinary fonts and on-demand FFmpeg assets may require network access. Preserve cross-origin isolation and browser file/download behavior. See [media hosting](OFFLINE.md#media-runtime-assets).

## Ongoing verification

Use the pinned Bun version and the current package scripts:

```sh
bun run typecheck
bun run test
bun run lint
bun run build
bun run check:no-ai
node --test scripts/*.test.mjs
```

`check:no-ai` runs the consolidated runtime/configuration guard and the independent retired-cloud-GPU guard. Their regression tests cover prohibited dependencies/clients, entry points, model assets, provider URLs and exclusion loopholes without banning generic shader/model/mask terminology.

The remaining script tests cover browser runtime configuration, sound-library removal, service-worker caching/network-only APIs and the release harness. `scripts/validate-ai-removal-release.test.mjs` checks the harness without launching a browser. Current-format fixtures and serializer, editing, caption, creation and export tests remain; they do not require the deleted documentation baselines.

Browser verification is opt-in through `bun run check:release-browser`. The harness is `scripts/validate-ai-removal-release.mjs`; independent media inspection uses `apps/web/scripts/validate-browser-export.mjs` with its documented prerequisites. Do not silently resume deferred browser/export investigations or add a browser-automation dependency. Keep new verification artifacts under ignored `.codex-audit/`. Browser checks do not validate every native creation backend; those builds need their existing CMake/C++20/Emscripten prerequisites.

## Known verification limits

- Basic manual video export has succeeded, but fuller automated export-dialog runs have intermittently stalled around 39% / “Rendering…”. The cause is unisolated; it is not established as a general export failure or an offline-specific problem. The unsuccessful experimental encoder change was reverted, not shipped as a fix.
- Broader wide/compact browser smoke tests, cross-browser/GPU comparisons and the export-stall investigation remain deferred. Earlier passing runs are not a comprehensive reliability sign-off.
- Offline checks covered bounded core workflows after assets were available, not a fresh offline app load or comprehensive offline support. Uncached fonts/FFmpeg still require their assets to be reachable.
- Audio-export tests cover settings, routing, WAV output, progress labels and mocked compressed-encoder/fallback behavior. They do not establish real browser compressed encoding, hosted FFmpeg execution or independent decoding of those new audio outputs.

Detailed historical measurements and phase-specific test counts belong to Git history, not current feature or performance claims.
