# OpenReel project guide

## Overview

OpenReel is a local-first browser and desktop video editor, with separate image editing and effect-authoring apps. Core editing, preview, and rendering are intended to work on-device; optional AI and connected services may use the network. Preserve that distinction when changing media or network flows. The main stack is TypeScript, React, Zustand, Vite, Vitest, WebCodecs/Web Audio/WebGPU, MediaBunny, and Electron.

## Workspace map

This is a pnpm monorepo (`pnpm-workspace.yaml`, `apps/*` and `packages/*`). Package scripts and current source are authoritative; some older documentation describes only the web app.

- `apps/web`: main video editor and desktop renderer. `src/components/editor` contains editor UI; `src/stores` has Zustand project, timeline, UI, and engine state; `src/bridges` connects UI/state to core engines; `src/services` and `src/workers` handle app services and background work. `src/motion` is the motion-creation workspace. `src/App.tsx` is the app entry.
- `apps/desktop`: Electron main process, preload, IPC, native integrations, MCP, and packaging. It builds and embeds the web renderer; see `apps/desktop/DISTRIBUTION.md`.
- `apps/image`: standalone React image editor, backed by `packages/image-core`.
- `apps/studio`: standalone effect/filter authoring and publishing app; includes Playwright tests.
- `apps/cloud`: Cloudflare Worker for connected services, including marketplace and crash endpoints; see its README and Wrangler configuration.
- `packages/core`: shared editor engines and types. Start in `src/timeline`, `editing`, `media`, `playback`, `video`, `audio`, `effects`, `export`, `storage`, `motion`, or `creation`, as appropriate. AssemblyScript WASM sources live under `src/wasm`.
- `packages/agent`: AI provider/tool loop, registry, executor, and host interfaces. `packages/agent-runner` supplies a Node/headless runner. `packages/creation-agent` and `packages/creation-schema` cover creation tools and schemas. See `docs/ai-editing.md` and `docs/AGENT-GUIDE.md`.
- `packages/creation-core`: C++20 native creation engine; `packages/creation-bindings` provides native/WASM bindings with a TypeScript CPU fallback in `@openreel/core/creation`. See `packages/creation-core/README.md`.
- `packages/fxpkg`: effect package types, validation, compiler, and related utilities. `packages/ui` contains shared UI components. `packages/image-core` contains image models and operations.
- `docs/superpowers`: design specs and plans (useful context, not necessarily current implementation). `docs/MOBILE-OFFLINE.md`, `docs/MOBILE-PARITY.md`, and `docs/android-port` cover mobile work. `infra` holds infrastructure assets; `scripts` contains verification and utility scripts.

## Setup and commands

Use the pnpm version pinned in root `package.json` (currently 11.7.0); CI uses Node 22 and `pnpm install --frozen-lockfile`. The repository also contains a Bun lockfile, but CI and workspace scripts use pnpm.

```sh
pnpm install
pnpm dev                         # web Vite dev server
pnpm build                       # build core WASM, then web
pnpm typecheck                   # recursive workspace typechecks
pnpm test                        # recursive test:run (one-shot Vitest)
pnpm test:watch                  # recursive watch-mode test scripts
pnpm lint                        # recursive lint scripts
pnpm --filter @openreel/web test:run
pnpm --filter @openreel/web exec vitest run src/path/to/example.test.ts
pnpm --filter @openreel/core typecheck
pnpm --filter @openreel/image dev
pnpm --filter @openreel/studio dev
pnpm --filter @openreel/studio test:e2e
pnpm --filter @openreel/desktop dev
```

Recursive commands run only in packages defining the named script. The root `pnpm build` builds the web app, not every app; desktop dev first builds its renderer. Native creation builds require CMake/C++20, and WASM native builds require Emscripten. Desktop packaging can fetch native assets/FFmpeg; consult its scripts and distribution guide before running it. Root `pnpm clean` removes build artifacts and web source files matching generated JS/declaration patterns; inspect the script before using it.

## Implementation and verification notes

- Follow existing local patterns and `CONTRIBUTING.md`; TypeScript is strict with unused locals/parameters checked (`tsconfig.base.json`). Prefer explicit types and avoid `any`.
- Shared workspace imports resolve to source via TypeScript paths and app-specific Vite aliases. If adding a package or alias, check the relevant package exports, TypeScript, Vite, and Vitest configurations.
- Tests are generally colocated as `*.test.ts`/`*.test.tsx`; web Vitest uses jsdom and `apps/web/src/test/setup.ts`. Add focused tests around changed behavior and run the relevant package tests/typecheck before broader CI checks. Browser codecs, GPU, native, and desktop behavior may require manual/platform-specific verification.
- Editor changes may span project/timeline state, core actions or engines, bridges, persistence, undo/redo, preview, and export; inspect the relevant paths and cover affected behavior rather than changing UI alone. Keep web and desktop differences in mind.
- Web Vite dev/preview sets COOP/COEP headers; desktop renderer builds use `OPENREEL_DESKTOP=1`, relative asset paths, and custom FFmpeg/font plugins. Avoid breaking cross-origin isolation or desktop asset loading. FFmpeg dependencies have workspace patches under `patches/`.
- CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests, then the root build. `CONTRIBUTING.md` has older test-command descriptions: root `pnpm test` is the one-shot command; there is no root `test:run` script.
- Focus changes; do not commit generated outputs or modify lockfiles unless dependencies actually change. Review existing changes before editing.
