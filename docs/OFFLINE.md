# Offline behavior of the browser editor

This fork contains the browser app, not the formerly described iOS, Android or desktop apps. Old mobile ML/native-sidecar instructions and the missing mobile-offline check do not apply.

## Local editing

Timeline editing, titles/manual captions, SRT/VTT import, audio processing, chroma key, manual masks, heuristic reframing, motion/3D creation, preview and browser export process media on-device. No speech recognition, segmentation, inference engine, model catalog/download fallback or external generative service remains.

Offline operation still requires the app assets and any ordinary fonts/FFmpeg resources needed by a workflow to be available locally or cached. The service worker caches static assets and uses network-only requests for `/api/` services, returning a generic `NETWORK_UNAVAILABLE` response offline. It has no AI-availability protocol. Ordinary font/media-asset networking is separate from local editing. PostHog/analytics has been removed, and hosted share-viewer links redirect to the editor without mounting the viewer.

No retirement migration, model-cache sweep or automatic user-storage deletion is installed. Current project/autosave/media persistence and manual relinking remain.

## Media runtime assets

Downloading executable media assets does not upload source media. FFmpeg cores are hosted separately, not bundled into the app; the MediaBunny decode worker is bundled.

### Hosted FFmpeg assets

The loaders use `https://ssh.karri.me/vid-assets/` with this layout:

```text
vid-assets/
  ffmpeg/
    ffmpeg-core.js
    ffmpeg-core.wasm
  vidstab-st/
    ffmpeg-core.js
    ffmpeg-core.wasm
  vidstab-mt/
    ffmpeg-core.js
    ffmpeg-core.wasm
    ffmpeg-core.worker.js
```

- `packages/core/src/media/ffmpeg-fallback.ts` downloads the two `ffmpeg/` assets when `load()` is called. It uses the same URLs regardless of `crossOriginIsolated`; no pthread worker is requested. Concurrent calls share initialization, and completed initialization is reused. Fetches support cancellation; temporary Blob URLs are revoked after initialization or failure. A failed/cancelled load can be retried.
- `packages/core/src/video/stabilization/vidstab-engine.ts` selects `vidstab-mt/` when `crossOriginIsolated` is true; false or unavailable selects `vidstab-st/`. It converts downloaded assets to Blob URLs using `@ffmpeg/util` before loading the core. Only the multithreaded variant requests `ffmpeg-core.worker.js`. Concurrent/completed loads are reused, and failed loads can be retried. Both vidstab builds must contain the `vidstabdetect` and `vidstabtransform` filters.
- The `@ffmpeg/ffmpeg` wrapper and its worker remain app dependencies. The separately hosted JavaScript/WASM files must be mutually compatible and compatible with the installed wrapper. There is no alternate-CDN fallback in either loader.

### Self-hosting requirements

- Serve the app over HTTPS (or localhost for development). Preserve `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` to enable cross-origin isolation and multithreaded vidstab. Vite dev/preview configures these; a production static host must configure its own headers.
- If the asset origin differs from the app origin, permit CORS fetches from the app origin (or `Access-Control-Allow-Origin: *` for these public, credential-free assets).
- Return the actual files rather than an SPA HTML fallback. Serve JavaScript as `text/javascript` and WASM as `application/wasm`.
- If adding a CSP, account for fetches to the hosted asset origin, the app's module worker, Blob-based FFmpeg workers/scripts and WebAssembly compilation. No change to CSP or server configuration is made by these loaders.

These are deployment requirements, not a claim that the live host's files, headers or codec behavior have been verified.

### Bundled MediaBunny decode worker

`packages/core/src/video/parallel-frame-decoder.ts` constructs a module worker using `new Worker(new URL("./decode-worker.ts", import.meta.url), { type: "module" })`. Vite emits the worker with the installed, lockfile-resolved MediaBunny dependency. There is no raw string/Blob worker, bare-specifier runtime import or `esm.sh` fallback.

`decode-worker.ts` is a worker entry, not a main-thread import. Shared request/response types live in `decode-worker-types.ts`; the video barrel exports the types without executing the worker entry. Successful module startup acknowledges `mediabunnyAvailable: true`. A worker that fails or times out during initialization is terminated instead of fetching another dependency.

Each worker serializes frame decoding through its canvas-to-bitmap copy, caches an input/sink per clip and dimensions, disposes inputs on dimension changes or setup failures, and transfers decoded bitmap ownership to the caller. If transfer fails, it closes the untransferred bitmap and reports an error. This does not guarantee support for every browser codec or media format.

The app's emitted worker assets must be available just like its other application assets. MediaBunny no longer needs a separate CDN download, but a fresh offline app load is not guaranteed. FFmpeg conversion and stabilization still require the hosted cores to be reachable or otherwise available to the browser. An already initialized core can be reused in that instance; this is not persistent offline installation.

### Focused media checks

```sh
bun run --filter @openreel/core test:run src/media/ffmpeg-loader-lifecycle.test.ts src/media/ffmpeg-audio-extraction.test.ts src/media/ffmpeg-proxy-cancellation.test.ts src/video/stabilization/vidstab-engine.test.ts src/video/decode-worker.test.ts src/video/parallel-frame-decoder.test.ts
bun run --filter @openreel/core typecheck
```

These unit tests mock FFmpeg, MediaBunny and browser worker/bitmap APIs. They cover loader URLs, thread selection, lazy/shared loading, cancellation/retries, worker startup/termination, resource reuse/disposal, request serialization and bitmap transfer/error handling. They do not download live assets, run real codecs or replace browser smoke tests.

## Verification

```sh
bun run check:no-ai
bun run check:retired-cloud-gpu
node --test scripts/check-no-ai.test.mjs scripts/ai-removal-phase*.test.mjs scripts/browser-runtime-config.test.mjs
```

These source/configuration checks and the service-worker VM regression tests complement request logging; they do not prove every browser/codec workflow works offline. Repeat import/edit/preview/export after assets are available as part of Phase 5's release gate. See [the removal plan](remove-ai-features.md) and [manual editor workflows](editor-workflows.md).
