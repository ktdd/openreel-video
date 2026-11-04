# Manual browser editor

This fork opens directly into its local-first browser video editor. There is no desktop app/IPC integration, landing/template browser, Screen recorder, guided tour, multicam workflow, chat, agent/MCP editing, generative provider or on-device speech/segmentation model.

## Retained workflows

- Import video, audio and images; trim, split, layer tracks, animate/keyframe, group, undo/redo and relink missing original media.
- Create titles and edit captions manually. Import SRT/VTT through the Captions section; subtitle parsing/export and caption timing/word metadata remain. There is no automatic transcription or speech-recognition fallback.
- Use Green Screen/chroma key, drawn masks, grading, effects, DSP audio cleanup, silence/energy/beat editing, stabilization and heuristic reframing without a model download.
- Keep Recipes, built-in/custom export presets, portable edit JSON/presets and edit sharing. Project JSON is content, not an executable agent script.
- Edit motion/3D creation scenes using the deterministic engines. Native/WASM creation bindings and the TypeScript CPU implementation remain; they do not depend on the removed desktop IPC bridge. Existing generated GLSL remains editable/renderable content, with validation, registries and parameter/keyframe controls; there is no prompt-to-shader producer.

## Projects and exports

Projects use browser storage/autosave and browser file APIs. The project menu supports current-format new/open/recent/save/backup/recovery flows; original media is preserved. Removing features does not clear media, preferences, databases or credentials.

Export uses browser codecs and original media. Download to the device or choose a file location for streaming. Cancellation is not a successful save, and write/permission failures must be surfaced without silently choosing a different destination. Codec support depends on the browser: unsupported ProRes/alpha/high-bit-depth requests require explicit H.264 normalization acknowledgement. For transparent motion output choose PNG Sequence in the render queue. Do not recommend the removed desktop app as an alternative.

## Networking and offline use

Media editing, preview and export run locally. Optional sharing and explicitly configured analytics, ordinary font loading and FFmpeg asset loading can use the network; this is not a blanket no-network claim. See [offline behavior](MOBILE-OFFLINE.md) and [browser export verification](../apps/web/docs/browser-export-validation.md).

## Development

Use Bun **1.4.3**, the checked-in lockfile and `AGENTS.md`. Run `bun install --frozen-lockfile`, workspace typechecks/tests/lint/build, `bun run check:no-ai` and the focused Node guard tests. The consolidated check also runs the independent retired-cloud-GPU guard.

See [the removal plan](remove-ai-features.md) and its phase evidence for verified behavior versus remaining release gates. `README.md`/`CONTRIBUTING.md` and dated design/QA reports retain upstream/historical information; they do not restore removed features.
