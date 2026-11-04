# AI removal: Phase 4 and desktop cleanup completed

Implements [Phase 4](remove-ai-features.md), plus the user's request to remove the obsolete desktop renderer and wiring. Phase 5 remains the release gate. No commit was made.

The user deleted the **43 audited desktop-only files** after recursive deletion was blocked by the tool policy. Verified their removal and completed the references/configuration/tests. Empty local directories left by file deletion contain no implementation and are not tracked by Git.

## Browser-only application boundary

- `main.tsx` now renders only `App`; removed the lazy desktop entry and native encoder factory installation.
- Removed desktop UI, start screen/bootstrap, window/menu/update/crash/unsaved-close adapters and their exclusive tests. Removed `desktopPage` and its setter/persistence key/desktop migration branch; retained ordinary UI preferences and current-format persistence. No storage version bump or retirement migration was added.
- Deleted the ambient `Window.openreel` contract, native FFmpeg adapter, native media/probe/hardware-profile helpers, native Aurora preview sessions, the core desktop Aurora bridge, desktop Vite plugins and desktop bundle checker. Vite has one browser configuration, with unchanged COOP/COEP headers.
- Removed native-dialog/file-reference branches from project management and export. Browser open/save/recent projects, file handles, download/OPFS/streaming, cancellation, write-error reporting and abort/retry safety remain. Removed the obsolete `streamToFile` switch, not the browser's choose-location streaming option.
- Removed native media transcode/proxy/probe/audio-extraction branches. Browser MediaBunny/WebCodecs and FFmpeg WASM paths remain. Audio extraction/recorded-stream separation remain sequential and validated.
- Removed desktop font/share-origin/service-worker exceptions. Sharing uses the browser origin; normal optional font loading remains. Removed native-menu export listeners and desktop-only export widgets/messages.
- Removed native Aurora overrides from core/browser motion asset resolvers and the stage. These overrides previously returned no result in browsers; normal browser scene rendering and the stage's deterministic CPU preview remain. Remote GLB/GLTF URLs go directly to the browser loader and obey browser CORS, not a desktop download proxy.
- Export guardrails cannot be bypassed by injecting a desktop-looking global. Unsupported ProRes/alpha/high-bit-depth requests still require explicit H.264 acknowledgement; PNG Sequence remains the transparent motion export option. Built-in/custom presets are retained.

**Preserved:** deterministic creation C++20/native/WASM/TypeScript CPU implementations and bindings, creation synchronization/conversion, ordinary motion/3D editing/rendering, generic encoder interfaces, saved GLSL/registries/validators/effects/keyframes, manual captions/SRT/VTT, chroma key/manual masks, heuristic reframing, stabilization/DSP/beat/energy tools, Recipes, sharing, current-format project/media persistence and recovery. Desktop IPC removal is not deletion of all native or WASM code.

## Dependency and build audit

Importer searches found no retained consumer for these web declarations:

- `react-markdown`, `remark-gfm`: chat-only presentation no longer exists.
- `@gsap/react`, `@paper-design/shaders-react`: removed UI/landing wrappers have no importer.
- Web's direct `gsap` and `idb-keyval`: no web importer. Also removed core's unused `idb-keyval`.

Kept core `gsap` for ordinary animation/motion paths, core `@paper-design/shaders` for saved/built-in GLSL, `framer-motion` for Toast, `react-syntax-highlighter` and its types for the ordinary project JSON dialog, shared Radix/UI packages, Three, MediaBunny, FFmpeg and optional configured analytics. No blanket markdown/shader/model/mask removal was applied.

Reviewed root/web TypeScript, Vite/Vitest, manifests/exports/scripts and remaining workspaces. Retired agent/schema/inference paths remain absent. Pruned obsolete desktop `.gitignore` exceptions. Regenerated the lockfile with **Bun 1.4.3**, not by hand; final diff is **4 added / 174 removed lines**, including explicit Node tooling types and a same-version `unenv` hoist. FFmpeg patches remain unchanged. Frozen installation passes.

### Isolated fresh-install proof

A source snapshot of **1,394 current files**, excluding dependency/build output directories, was installed outside this checkout with no ancestor repository `node_modules`. Final `clean-report.json` records a newly created short-path scratch workspace with:

1. `bun install --frozen-lockfile` — passed.
2. `bun run check:no-ai` — passed, including the independent cloud-GPU guard.
3. `bun run build` — passed, including core WASM compilation and the web production build.

This caught real reproducibility issues hidden by the existing dependency tree: undeclared Node test/tooling types and implicit disposable-symbol library declarations. Added root **dev-only `@types/node`** (locked to 22.20.5, with `undici-types`), explicitly included `ESNext.Disposable`, and replaced two browser `NodeJS.Timeout` annotations with `ReturnType<typeof setTimeout>`. These are type/build requirements, not Node runtime networking or a new encoder backend.

The first attempt under a long Windows user-temp path failed while copying the CLI package; a shorter isolated path installed successfully. The initial short-path build then exposed the type issues above; the final clean install/check/build passed after correction. Scratch locations are recorded in the audit output; no existing user directory was cleaned or replaced. Native C++/Emscripten backends were not rebuilt as part of unrelated browser verification.

## Assets, workers, deployment and bundles

Audited **279 tracked public assets**: icons/manifest/worker placeholder and ordinary fonts/typeface data. No tracked retired model, inference worker or removed-feature-only media asset remained to delete. Preserve fonts, including the typefaces used by ordinary 3D text; do not confuse them with ML models.

Reviewed HTML/preconnects, environment example, deployment configuration, redirects/headers, public service worker and generated output. Remaining optional analytics settings and ordinary font/FFmpeg/sharing networking are not AI clients. No inference preload/CSP/model URL, proxy function, generated `_worker.js` or `_routes.json` remains. Public static caching and generic network-only API/offline handling remain; no AI availability protocol, cache sweep or model fallback was reintroduced.

Production JS/HTML/CSS audit: **25 files scanned; zero retired AI/provider/desktop identifiers or forwarding artifacts found.**

Same-machine Phase-3-output → final Phase-4-output measurements, using the Phase 0 bundle utility:

| Measurement | Before | After |
| --- | ---: | ---: |
| Emitted files, including lazy/worker assets | 39 | 26 |
| Emitted bytes | 5,228,470 | 5,183,791 |
| Independently gzipped emitted bytes | 1,462,171 | 1,440,127 |
| Emitted JS files | 34 | 22 |
| Copied public bytes | 5,532,913 | 5,532,913 |

Reduction: **44,679 emitted bytes / 22,044 gzip bytes**. These are all emitted assets, not initial-load transfer measurements. Unused dependencies that were already tree-shaken can shrink the install graph without materially shrinking JS.

## Consolidated guard and regression tests

Added `scripts/check-no-ai.mjs` and root `bun run check:no-ai`. The root script **also runs the unchanged `check-retired-cloud-gpu.mjs`**; its endpoint/client/infrastructure guarantees remain independently effective.

The new guard checks runtime/server/native source, public workers/model assets, package/lockfile/configuration/environment documentation and aliases for known retired implementations/packages/provider-model URLs, dormant agent/desktop entry points and legacy cleanup clients. It excludes dependencies/generated outputs/configuration timestamps and non-runtime test modules. Only **two exact historical JSON fixture paths** are exempted, not entire fixture directories; importing those fixtures or excluded test modules into runtime code is rejected. Empty directories have no shippable implementation. It does not ban generic `ai`, `model`, `generated`, `mask` or `shader` substrings.

Added adversarial guard tests for source/server/manifest/alias/environment/CSP/preconnect/redirect/model/desktop/cleanup reintroductions and exclusion loopholes. Retained-data tests prove ordinary 3D model URLs, GLSL, masks, geometry and sharing are not false positives. Root integration tests retain FFmpeg patch and cloud-guard checks and explicit fresh-build type requirements.

Replaced desktop success expectations with browser asset/cache/export and format-guardrail coverage; removed obsolete native mocks. Earlier phase source guards now inspect the browser entry instead of deleted desktop files and do not require an audited unused dependency. Historical fixtures and Phase 0/1/2/3 evidence remain unchanged.

All final checks passed:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run lint
bun run build
bun run check:no-ai
node --test scripts/check-no-ai.test.mjs scripts/ai-removal-phase*.test.mjs
```

- **5 workspace typechecks** passed.
- **334 test files; 2,309 passed tests; 27 existing skips**. Removed desktop-only success suites account for the lower count; no new skips were added.
- **Lint: 0 errors, 97 warnings**, down from 103. Existing jsdom WebGL2, Node FFmpeg and mixed-import/large-chunk diagnostics remain non-failing.
- **Production build: 5,938 modules**, successful.
- **56 Node baseline/guard tests** passed.
- No-AI guard: **731 runtime/configuration files**. Independent retired-cloud-GPU guard: **1,029 runtime source files**.
- `git diff --check` passed; no generated build outputs are tracked.

Final source checks ran after Vitest/build: older phase scanners can otherwise race Vite's transient timestamped config files. The new consolidated guard explicitly excludes those generated filenames. Initial obsolete test expectations/type errors were corrected, not hidden with skips.

## Real browser/export regression

Fresh Edge/SwiftShader profile and directly owned Vite server, with real codecs/renderers and no browser dependency added. Repeated the Phase 3 harness with an injected **getter for the retired desktop global**: **zero reads** across startup, navigation, import/editing, caption load, reload, preview and export. The live UI project name is checked to ensure the harness and UI share the actual store, not separate stale-HMR instances.

Passed:

- Wide/compact manual navigation; compact **Timeline / Media / Edit**; music, filters, titles and manual settings.
- Real video and WAV imports through stores; trim In to 0.5s, undo/redo, layered transforms/keyframes, grouping and track states.
- DOM caption-file input assignment for **both SRT and VTT**, actual input handlers/readers, caption editing and current-project reload.
- Ordinary title visible in core preview (**22,856 changed pixels**) and actual UI preview, both during an intro crossfade and afterward (**12,044 title-background pixels**).
- Saved generated GLSL JSON/registry round-trip and real WebGL2 execution: **[204, 128, 0, 255]**.
- Five-track browser export: **309,931-byte MP4**, **36 frames**, **1.500000 seconds**, **640×360 H.264 at 24 fps**, **48 kHz stereo AAC**; ffprobe/full decode passed.
- Independently decoded title-region comparison at 0.75s: **11,594 title-background pixels**, mean RGB error **7.97/255**, below the 15/255 lossy-encode threshold.

```sh
node apps/web/scripts/validate-browser-export.mjs verify trim-start .codex-audit/phase4/trimmed.mp4
node .codex-audit/phase4/check-frames.mjs
```

Captured **700 page requests**, 13 target events, worker constructors, storage reads and database opens/deletes. No retired AI/model/provider/desktop request or identified ML worker was observed; no uncaught exception or database deletion occurred, and an unrelated preference survived. Font/autosave/motion-preset/media databases and Blob/FFmpeg workers remain. Page requests and worker-constructor/target observations are not blanket interception of opaque workers' internal networking; source/dependency/bundle checks independently cover removed clients.

## Documentation and remaining gate

Updated `AGENTS.md`, `llm.txt`, creation-core build guidance and editor/offline/export docs. Retired active agent/capability/AI-workspace guides and stale verification/setup commands. Added `docs/editor-workflows.md`, an archive-wide supersession index and **24 AI/desktop-centered historical notices**, retaining original dated design bodies and distinguishing retained deterministic work. Dated web QA reports now identify pre-removal feature claims as historical.

`README.md`, `CONTRIBUTING.md`, Phase 0/1A/1B/1C/2/3 evidence and fixtures are unchanged. No persistence/credential sweep, startup cleanup, legacy reader, fallback marker or model-cache deletion was added.

All new raw logs/harnesses/reports/media are under ignored **`.codex-audit/phase4/`**, not root `.log` files. Isolated install workspaces live outside the repository, as recorded in the clean-install report.

**Phase 5 remains:** hand-driven file-picker/export-dialog/download, broader current-format recovery/relink/preset/motion editing, offline after asset availability, cross-browser/GPU/visual release checks and final release review. Automated DOM input plus real stores/engines is not a claim that those manual gates were completed.
