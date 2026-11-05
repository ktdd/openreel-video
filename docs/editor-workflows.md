# Manual browser editor

This fork opens directly into its local-first browser video editor. There is no desktop app/IPC integration, landing/template browser, Screen recorder, guided tour, multicam workflow, chat, agent/MCP editing, generative provider or on-device speech/segmentation model.

## Retained workflows

- Import video, audio and images; trim, split, layer tracks, animate/keyframe, group, undo/redo and relink missing original media.
- Create titles and edit captions manually. Import SRT/VTT through the Captions section; subtitle parsing/export and caption timing/word metadata remain. There is no automatic transcription or speech-recognition fallback.
- Use Green Screen/chroma key, drawn masks, grading, effects, DSP audio cleanup, silence/energy/beat editing, stabilization and heuristic reframing without a model download.
- Keep Recipes, built-in/custom export presets, portable edit JSON/presets and edit sharing. Project JSON is content, not an executable agent script.
- Edit motion/3D creation scenes using the deterministic engines. Native/WASM creation bindings and the TypeScript CPU implementation remain; they do not depend on the removed desktop IPC bridge. Existing generated GLSL remains editable/renderable content, with validation, registries and parameter/keyframe controls; there is no prompt-to-shader producer.

## Editor controls and appearance

The editor defaults to Dark, including the initial HTML styling. A saved explicit Light/Dark preference is preserved. The theme rail button switches directly between Light and Dark; it does not follow the operating-system theme. Unsupported saved modes resolve to Dark.

Settings has its own gear button immediately below the theme control and highlights while open. It opens manual preferences and Project Composition controls, not API-key/provider settings. Help, Project JSON and the Ctrl/Cmd+K search hint remain in the star menu. Icon-only rail controls retain accessible names and custom tooltips without duplicate native title popups; labeled asset tabs also omit redundant native titles.

## Projects and exports

Projects use browser storage/autosave and browser file APIs. The project menu supports current-format new/open/recent/save/backup/recovery flows; original media is preserved. Removing features does not clear media, preferences, databases or credentials.

Export uses browser codecs and original media. Download to the device or choose a file location for streaming. Cancellation is not a successful save, and write/permission failures must be surfaced without silently choosing a different destination. Codec support depends on the browser: unsupported ProRes/alpha/high-bit-depth requests require explicit H.264 normalization acknowledgement. For transparent motion output choose PNG Sequence in the render queue. Do not recommend the removed desktop app as an alternative.

Both the primary Export button and its options arrow are disabled on an empty timeline. Emptying the timeline closes an open options menu; adding content does not automatically reopen it. Preset video, WAV and custom-settings exports remain available for valid content.

## Networking and offline use

Media editing, preview and export run locally. PostHog, its event calls and analytics configuration have been removed. Hosted `#/share/...` routes open the editor rather than a sharing viewer; retained portable edit sharing is separate. Ordinary font and FFmpeg asset loading can still use the network, so this is not a blanket no-network claim. See [offline behavior and media hosting](OFFLINE.md) and [browser export verification](../apps/web/docs/browser-export-validation.md).

### Fonts

Startup UI typography still requests Geist, Geist Mono and Inter from Google Fonts. Selected/project fonts load on demand, and custom font uploads remain supported through browser storage/FontFace. The unused vendored WOFF2 files and unreferenced `google-fonts.css` were removed; they were not the app's active font source. `apps/web/public/fonts/` retains the regular and bold Helvetiker JSON fonts referenced by 3D preview rendering. This cleanup does not guarantee that uncached Google Fonts work offline.

## Development

Use Bun **1.4.3**, the checked-in lockfile and `AGENTS.md`. Run `bun install --frozen-lockfile`, workspace typechecks/tests/lint/build, `bun run check:no-ai` and the focused Node guard tests. The consolidated check also runs the independent retired-cloud-GPU guard.

The web build produces `apps/web/dist/` for a self-hosted static server. Wrangler and the app/root `deploy` and `deploy:preview` shortcuts have been removed; the app does not require Cloudflare Pages. Configure production cross-origin isolation headers and the separately hosted FFmpeg assets as described in [media hosting](OFFLINE.md#self-hosting-requirements). The optional `scripts/filters` generator/deployer is a separate utility, not the app deployment pipeline.

Focused configuration regressions (initial theme, dependency/config removal, fonts and current documentation links):

```sh
node --test scripts/browser-runtime-config.test.mjs
```

See [the removal plan](remove-ai-features.md) and its phase evidence for verified behavior versus remaining release gates. `README.md`/`CONTRIBUTING.md` and dated design/QA reports retain upstream/historical information; they do not restore removed features.
