# OpenReel project guide

## Overview

This fork focuses on the local-first browser video editor. Core editing, preview, and rendering are intended to work on-device; optional connected services such as sharing may use the network. Preserve that distinction when changing media or network flows. The main stack is TypeScript, React, Zustand, Vite, Vitest, WebCodecs/Web Audio/WebGPU, and MediaBunny.

## Workspace map

This is a Bun workspace (`apps/*` and `packages/*` in root `package.json`). Package scripts and current source are authoritative; older documentation may describe removed apps or pnpm.

- `apps/web`: main video editor. `src/components/editor` contains editor UI; `src/stores` has Zustand project, timeline, UI, and engine state; `src/bridges` connects UI/state to core engines; `src/services` handles app services; shared media/export workers live in core. `src/motion` is the motion-creation workspace. `src/App.tsx` is the app entry. Desktop renderer UI, native-sidecar IPC adapters and desktop build modes have been removed; the entry renders only the browser app.
- `packages/core`: shared editor engines and types. Start in `src/timeline`, `editing`, `media`, `playback`, `video`, `audio`, `effects`, `export`, `storage`, `motion`, or `creation`, as appropriate. AssemblyScript WASM sources live under `src/wasm`.
- `apps/web/src/services/editing`: retained manual editing transactions, portable edit JSON/presets and creation synchronization. Agent workspaces, generative services and their provider settings were removed in Phase 2; see `docs/ai-removal-phase2.md`. On-device transcription/segmentation was removed in Phase 3; see `docs/ai-removal-phase3.md`. Caption content/editing and deterministic reframing remain.
- `packages/creation-core`: C++20 native creation engine; `packages/creation-bindings` provides native/WASM bindings with a TypeScript CPU fallback in `@openreel/core/creation`. See `packages/creation-core/README.md`.
- `packages/fxpkg`: effect package types, validation, compiler, and related utilities. `packages/ui` contains shared UI components.
- `docs/editor-workflows.md`: current manual workflows; `docs/OFFLINE.md`: browser offline boundaries and media asset hosting. Historical mobile parity/design archives have been removed; current source/tests define retained deterministic features. `scripts` contains verification and utility scripts.

## Setup and commands

Use the Bun version pinned in root `package.json` and install Node.js/npm as well (the core WASM build invokes npm). The lockfile is `bun.lock`.

```sh
bun install --frozen-lockfile
bun run dev                         # web Vite dev server
bun run build                       # build core WASM, then web
bun run typecheck                   # workspace typechecks
bun run test                        # one-shot workspace Vitest suites
bun run test:watch                  # workspace watch-mode tests
bun run lint                        # workspace lint scripts
bun run check:no-ai                 # runtime/config absence + retired cloud-GPU guard
node --test scripts/check-no-ai.test.mjs scripts/ai-removal-phase*.test.mjs scripts/browser-runtime-config.test.mjs
bun run --filter @openreel/web test:run src/path/to/example.test.ts
bun run --filter @openreel/core typecheck
```

Workspace commands run only in packages defining the named script. Root `bun run build` builds the web app, not every package. Native creation builds require CMake/C++20, and WASM native builds require Emscripten. Root `bun run clean` removes build artifacts and web source files matching generated JS/declaration patterns; inspect the script before using it. On Windows, Ctrl+C may not stop the filtered dev server; this remains to be investigated.

## Implementation and verification notes

- Follow existing local patterns and `CONTRIBUTING.md`; TypeScript is strict with unused locals/parameters checked (`tsconfig.base.json`). Prefer explicit types and avoid `any`.
- Shared workspace imports resolve to source via TypeScript paths and app-specific Vite aliases. If adding a package or alias, check the relevant package exports, TypeScript, Vite, and Vitest configurations.
- Tests are generally colocated as `*.test.ts`/`*.test.tsx`; web Vitest uses jsdom and `apps/web/src/test/setup.ts`. Add focused tests around changed behavior and run the relevant package tests/typecheck. Browser codecs and GPU behavior may require manual verification.
- Editor changes may span project/timeline state, core actions or engines, bridges, persistence, undo/redo, preview, and export; inspect the relevant paths and cover affected behavior rather than changing UI alone.
- Web Vite dev/preview sets COOP/COEP headers; avoid breaking cross-origin isolation. FFmpeg dependencies have patches under `patches/`, configured in root `package.json` for Bun.
- `README.md` and `CONTRIBUTING.md` retain upstream pnpm and removed-app references; use the commands above instead.
- Focus changes; do not commit generated outputs or modify lockfiles unless dependencies actually change. Review existing changes before editing.
- Put verification logs, request captures and temporary harnesses under ignored `.codex-audit/`, never the project root. No retirement migrations, compatibility readers or storage/credential sweeps: preserve current-format data and deterministic backends.
