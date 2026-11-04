# AI removal: Phase 0 baseline

Recorded 2026-11-04 on Windows x64, Node `v26.8.2`, Bun `1.4.3`, source commit `5da5cce`. No AI implementation has been removed or disabled. `CONTRIBUTING.md` was reviewed; its outdated pnpm instructions were not used. `README.md` and `CONTRIBUTING.md` are unchanged, as requested. Layout/screenshots are deliberately skipped; the user will compare layouts manually.

## Verification before adding fixtures

All commands exited **0**. Full local logs are under ignored `.cache/ai-removal-phase0/`; no raw logs, build artifacts, or HAR response bodies are checked in.

| Command | Result | Approximate wall time |
| --- | --- | --- |
| `bun run typecheck` | All 9 workspaces with a typecheck script passed | 16 s |
| `bun run test` | 425 files passed; 3,066 tests passed; 27 skipped | 40 s |
| `bun run lint` | Web lint passed with **109 existing warnings**, 0 errors | 6 s |
| `bun run build` | Core AssemblyScript WASM and web TypeScript/Vite production build passed | 50 s |
| `bun run check:retired-cloud-gpu` | Passed | <1 s |

Tests and build ran concurrently; timings are observations, not performance benchmarks. Root workspace commands only run packages that define the requested script; lint currently covers web, not every package.

| Test workspace | Files passed | Tests passed | Tests skipped |
| --- | ---: | ---: | ---: |
| core | 175 | 1,354 | 20 |
| web | 204 | 1,155 | 7 |
| agent | 36 | 486 | 0 |
| agent-runner | 5 | 21 | 0 |
| creation-agent | 1 | 3 | 0 |
| creation-bindings | 1 | 6 | 0 |
| creation-schema | 1 | 2 | 0 |
| fxpkg | 2 | 39 | 0 |

Existing output caveats:

- jsdom tests print WebGL2-unavailable/effects initialization diagnostics; all test suites still pass. These are not evidence that actual GPU playback/export was exercised.
- Vite reports mixed static/dynamic imports for `MultiCameraPanel.tsx`, `ffmpeg-fallback.ts`, and `extract-audio.ts`, plus chunks over 500 kB. These warnings predate this work.
- Native CMake/Emscripten backend builds and browser screenshot automation were not run. The user manually exercised project creation, import, trim, and local export before supplying the HAR; the exported file itself was not supplied or independently inspected.

## Network baseline

Source: user-provided `localhost.har`, 48,479,602 bytes, SHA-256 `2866935b83035d23c5eda7aea7ed2cfdd67b82d2f5a3debed4fbb413e5078553`. It remains local and Git-ignored. Only the aggregate [network-baseline.json](network-baseline.json) is saved for sharing.

Workflow reported by the user: load editor, create project, import a file, trim, export to a local file. The capture spans about 60 seconds and does not separate requests by action.

- **843 requests**: 841 HTTP 200 responses and 2 WebSocket 101 upgrades; no recorded request failures.
- 828 HTTP requests to localhost and 2 local WebSocket connections. 824 requests are Vite development modules, not production bundle transfer or evidence of inference.
- **13 external requests**: 8 to `esm.sh` (MediaBunny), 2 to `unpkg.com` (FFmpeg JS/WASM), 1 to `fonts.googleapis.com`, and 2 to `fonts.gstatic.com`.
- No AI-provider, retired proxy, or model-download requests were observed in this capture. Local imports of AI source modules do not mean an inference request ran.
- HAR-reported transfer: **52,166,722 bytes**; decoded content: **75,097,705 bytes**. These are development-session totals, not a prediction of production download size.

This capture does **not** establish that AI is absent: it did not exercise chat, generation, automatic captions, segmentation, or multicam inference. It also does not prove offline operation: fonts, MediaBunny, and FFmpeg were fetched externally. Removing those non-AI network dependencies is outside this plan's scope.

The summary intentionally omits URL paths/query strings, headers, cookies, request/response bodies, media filenames, and initiator stacks. Classification is heuristic and backed here by inspection of the external resource paths, not a future AI-absence guarantee.

## Production build size

[Full asset measurements and hashes](bundle-baseline.json). Sizes are exact bytes; gzip is measured per asset at level 9 by the baseline script, not copied from rounded Vite output.

| Scope | Raw bytes | Gzip bytes |
| --- | ---: | ---: |
| Emitted JS + MJS (56 files) | 9,555,514 | 2,652,016 |
| CSS (3 files) | 258,566 | 45,282 |
| WASM (3 files) | 45,518,770 | 10,670,169 |
| HTML | 1,632 | 670 |
| **All emitted assets + HTML (63 files)** | **55,334,482** | **13,368,137** |
| Entire dist, including copied public assets (342 files) | 60,867,664 | Not measured |

Notable AI-related output:

- `ort-wasm-simd-threaded.jsep-B0T3yYHD.wasm`: **21,596,019 bytes**.
- `ort-wasm-simd-threaded.jsep-D5Jk56-t.wasm`: **23,914,392 bytes**.
- Together those two inference WASM assets account for **45,510,411 bytes**. Distinct filenames are recorded as observed; no assumption is made that both are downloaded in a single workflow.
- `whisper-worker-CXYG035b.js`: **870,810 bytes**.
- `person-segmentation-worker-D1jG2GZ2.js`: **5,221 bytes**.

Totals include lazy chunks and workers, not just initial-page downloads. These emitted assets are candidates for removal, not an exact prediction of savings: other chunks may be shared with manual features.

## Import/dependency inventory

The source inventory was rechecked against current code. [import-inventory.json](import-inventory.json) records file paths, line numbers, module specifiers, provider/model URL definitions, manifests, and aliases.

- 1,303 Git-visible JS/TS source files scanned, including Phase 0 test/tool additions.
- 307 matching imports/exports/dynamic imports/import types/require/mock/worker-URL references in **125 files**: 57 web, 47 agent, 8 agent-runner, 11 core, and 2 creation-agent files.
- 26 provider/model URL literals and 33 manifest/config references, including the Cloudflare production proxy.
- Relative imports are normalized so package-internal dependencies and transport tests are included. Source aliases in root/web TypeScript, Vite and Vitest are also recorded.

Limits: static literal references only; computed imports, dependency internals and the entire transitive graph are not resolved. A broad `@openreel/core` import can expose AI symbols without naming an AI module, so symbol-level call sites still require the manual inventory below. This is not an automated deletion list.

Manual audit confirms the high-risk boundaries in [the removal plan](../remove-ai-features.md):

1. Portable sharing and creation-to-motion sync depend on agent-host/transaction code despite being useful manual operations.
2. Segmentation has separate preview and video-engine render paths, plus text-behind-subject state; deleting inspector controls alone is insufficient.
3. The inspector AI tab mixes caption import/editing, beat editing, energy highlights, heuristic reframing, DSP cleanup, auto-color, and chroma key with ML features.
4. Canvas background generation, Lanczos/edge-directed upscaling, deterministic multicam drift/activity analysis, creation backends, and shader execution are non-AI and must be preserved.
5. Startup imports the Kie.ai poller; settings/UI/chat/tasks are persisted independently. Browser fixtures preserve those old states without mounting the poller.
6. Agent/MCP imports remain in desktop-specific web source even though the desktop app workspace is absent.

## Fixtures and new checks

See [fixtures.md](fixtures.md) for contents and future compatibility expectations. Frozen JSON documents retain the pre-removal schema and fields rather than rebuilding old data with current application defaults.

Added coverage:

- Core: **7 cases** for project validation/roundtrip, trimmed portable sharing, deterministic real PCM audio and SRT/VTT inputs, local completed-media save/restore, legacy pending/failed/live-effect inputs, and shader/creation binding preservation.
- Web: **4 cases** for current/older settings hydration retaining manual preferences, retired-state coverage, and task-to-placeholder reference integrity. These tests do not mount the application or start old jobs.
- Node baseline utility: **5 cases** for HAR privacy, Vite-vs-provider classification, missing-size/invalid HAR handling, import syntax parsing, and emitted-vs-public bundle measurements.

The core composite TypeScript project now explicitly includes its JSON test fixtures. No dependencies, runtime feature code, or lockfile were changed. Browser GPU/rendering and actual export regression coverage belong to later phases; JSON roundtrips are not a substitute for them.

### Final verification after Phase 0 additions

Re-ran root typecheck, tests, lint, production build, and retired-cloud-GPU check: **all passed**. The workspace suite now has **427 passing files, 3,077 passing tests and the same 27 skipped tests**; the 5 Node baseline-tool tests also pass. Lint remains at the same 109 warnings with 0 errors. The rebuilt emitted-asset report has **identical sizes and SHA-256 hashes for every asset** compared with the pre-fixture baseline. `README.md`, `CONTRIBUTING.md` and `bun.lock` have no diff.

## Reproduce without overwriting the historical baseline

Run from the repository root, using the existing installed toolchain. No Python, browser automation package, provider key, model download, or new dependency is needed.

```sh
mkdir -p .cache/ai-removal-phase0
node --test scripts/ai-removal-phase0.test.mjs
bun run --filter @openreel/core test:run src/test/ai-removal-fixtures.test.ts
bun run --filter @openreel/web test:run src/test/ai-removal-fixtures.test.ts

node scripts/ai-removal-phase0.mjs inventory > .cache/ai-removal-phase0/import-inventory-current.json
node scripts/ai-removal-phase0.mjs har localhost.har .cache/ai-removal-phase0/network-current.json
bun run build
node scripts/ai-removal-phase0.mjs bundle apps/web/dist .cache/ai-removal-phase0/bundle-current.json
```

Compare current reports to the saved JSON files in this directory. Keep raw HAR/logs/dist local. The HAR command only reads the capture; it never executes response content or contacts URLs from the file. Repeated builds may change hashed asset filenames, so compare byte totals and asset roles, not filenames alone.
