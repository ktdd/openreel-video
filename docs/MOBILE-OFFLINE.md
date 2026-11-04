# Offline behavior of the browser editor

This fork contains the browser app, not the formerly described iOS, Android or desktop apps. Old mobile ML/native-sidecar instructions and the missing mobile-offline check do not apply.

## Local editing

Timeline editing, titles/manual captions, SRT/VTT import, audio processing, chroma key, manual masks, heuristic reframing, motion/3D creation, preview and browser export process media on-device. No speech recognition, segmentation, inference engine, model catalog/download fallback or external generative service remains.

Offline operation still requires the app assets and any ordinary fonts/FFmpeg resources needed by a workflow to be available locally or cached. The service worker caches static assets and uses network-only requests for `/api/` services, returning a generic `NETWORK_UNAVAILABLE` response offline. It has no AI-availability protocol. Optional sharing cannot publish new data without connectivity; optional configured analytics and ordinary asset networking are separate from local editing.

No retirement migration, model-cache sweep or automatic user-storage deletion is installed. Current project/autosave/media persistence and manual relinking remain.

## Verification

```sh
bun run check:no-ai
bun run check:retired-cloud-gpu
node --test scripts/check-no-ai.test.mjs scripts/ai-removal-phase*.test.mjs
```

These source/configuration checks and the service-worker VM regression tests complement request logging; they do not prove every browser/codec workflow works offline. Repeat import/edit/preview/export after assets are available as part of Phase 5's release gate. See [the removal plan](remove-ai-features.md) and [manual editor workflows](editor-workflows.md).
