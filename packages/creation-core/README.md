# @openreel/creation-core

Deterministic **C++20 creation engine** with the C ABI in `include/creation_core.h`. Geometry, SDF, rigging, simulation, rendering and materials have TypeScript CPU reference implementations under [`@openreel/core/creation`](../core/src/creation). Agent and desktop-IPC integrations have been removed; the engine and its native/WASM/CPU bindings remain independent of them.

## Layout

- `include/creation_core.h`: host C ABI.
- `src/`: native implementations, including the Aurora renderer.
- `CMakeLists.txt`: native shared-library and Emscripten WASM builds.
- [`@openreel/creation-bindings`](../creation-bindings): loading and CPU fallback.

## Build and verification

Use pinned Bun 1.4.3. Native builds require CMake and a C++20 compiler; WASM builds also require Emscripten:

```sh
bun run --filter @openreel/creation-core build:native
bun run --filter @openreel/creation-core test:native
bun run --filter @openreel/creation-core build:wasm
```

The browser/workspace checks do not rebuild or validate every native backend. The removed desktop app's Aurora golden files/test commands are not available. Retained CPU rendering and binding tests live in `packages/core/src/creation/render/render.test.ts` and `packages/creation-bindings/src/index.test.ts`:

```sh
bun run --filter @openreel/core test:run src/creation/render/render.test.ts
bun run --filter @openreel/creation-bindings test:run
```

The binding falls back to the TypeScript CPU reference when an optional native/WASM implementation is unavailable. This is deterministic backend selection, not an inference or network fallback. See [manual editor workflows](../../docs/editor-workflows.md) and [the removal summary](../../docs/remove-ai-features.md).
