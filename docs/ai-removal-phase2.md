# AI removal: Phase 2 completed

Completes the remaining five checkboxes of [Phase 2](remove-ai-features.md), preserving the pre-existing first-three-checkbox changes. The [partial implementation record](ai-removal-phase2-first3.md) remains historical evidence, not the current feature inventory. Phases 3–5 are not implemented by this change.

## Remaining Phase 2 removals

### Voice and script generation

Deleted `TextToSpeechPanel`, `VoiceBrowser`, `ModelSelector`, `EnhancedTextPreview`, `AudioResult`, TTS types/constants, `useElevenLabsApi`, `useTtsActions` and `tts-store`. This removes voice/model discovery, ElevenLabs generation, LLM script enhancement, request/abort/playback lifecycle and unsaved-generation navigation warnings. Removed the temporary Text → Text to Speech entry point and barrel export; ordinary title editing remains directly under Text.

The enhancement input/preview widgets had only TTS consumers; they were not an independent script editor. Preserved `ScriptViewDialog` (project JSON viewing/import/export), portable edit JSON, title/caption editing, audio import and completed generated media. No completed media or user project content was deleted.

### Shader authoring, not shader execution

Deleted `GenerateShaderBox`, its tests, the generation service/prompt/tests and the remaining web `services/agent/llm-transport` implementation/test. Removed generation controls from motion effect, shape-fill and text-animator panels. Shader selectors now use saved names without appending `(AI)`.

Preserved shader registries, source validation, renderers, built-in/Paper shader browsing, parameters/keyframes, saved `generatedShaders` definitions/provenance, project registry lifecycle and `fxpkg`. No shader IDs, project definitions or render contracts were changed.

### Manual-only settings

Removed API Keys UI, provider registry/defaults, endpoint/model fields, favorites, API caches, session-lock hooks and settings tab state. Settings now renders the retained general panel directly. Project size/frame rate/background, autosave controls and persisted `autoSave`, `autoSaveInterval`, `language` remain under the same storage key.

Deleted the now-unreferenced credential vault client and its desktop tests, and unused desktop keychain/provider-fetch bridge contracts. No credential reader, migration, cleanup client, database deletion or preference reset was added. Removing the client does not delete any stored vault records.

### Transport and deployment

Deleted `api-proxy`, its compatible/desktop tests and the Cloudflare Pages provider-proxy function. Removed obsolete provider-specific service-worker exclusions; generic API/offline behavior and the still-live Phase 3 inference handling remain.

Audited `wrangler.toml`, Vite dev/preview, `_redirects`, `_headers`, `.env.example`, service worker, HTML and build outputs. There are no remaining provider forwarding functions, retired aliases or AI endpoint configuration. `config/api-endpoints.ts` was **not** deleted: its only current value is the optional video-sharing URL used by `share-service.ts`. Removed stale AI-proxy commentary and preserved that unrelated endpoint. COOP/COEP isolation headers remain unchanged.

Local **production preview** checks confirmed retired OpenAI, Anthropic and ElevenLabs proxy paths return SPA HTML for GET and 404 for POST, not upstream provider responses. There is no generated `_worker.js` or `_routes.json`. This is a source/build/local-preview verification, **not a deployment or claim about an already hosted instance**.

### Workspace removal and `creation-schema` decision

Deleted `packages/agent`, `packages/agent-runner`, `packages/creation-agent` and all their tools/runners/tests/configuration.

Before deleting `creation-schema`, audited imports throughout the workspace and configuration. Its only production consumers were `packages/agent` and `packages/creation-agent`; its other consumers were their tests or its own tests. The retained manual scene editor/synchronizer uses core creation types/conversion, not this separate schema/product-cinematic builder. With no retained deterministic consumer, **deleted `packages/creation-schema` too**. No native creation backend was removed: `creation-core`, `creation-bindings`, `@openreel/core/creation` and their CPU fallback remain.

Removed web dependencies and root/web TypeScript, Vite and Vitest aliases for deleted packages. Updated the project guide's workspace map. Removed obsolete agent mocks from already-detached manual tests; recursive source/configuration guards now verify the dependency boundary without providing a mock package.

Regenerated `bun.lock` using pinned **Bun 1.4.3**, then passed `bun install --frozen-lockfile`. Reviewed deletion of four workspace entries and runner-only `tsup` dependencies plus normal transitive hoist/deduplication changes (including esbuild). FFmpeg patches remain configured. No lockfile was hand-edited. Remaining inference dependencies and unused UI-dependency audits belong to Phases 3–4, not this partial dependency-pruning claim.

## Verification

Passed:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run lint
bun run build
bun run check:retired-cloud-gpu
node --test scripts/ai-removal-phase*.test.mjs
```

- **5 remaining workspace typechecks passed.** Four removed workspaces no longer participate.
- **355 test files passed; 2,391 tests passed; 27 existing skips.** The lower count reflects deleted agent/generation success-path suites, not new skipped tests.
- **Lint: 0 errors, 104 warnings.** Existing mixed-import/large-chunk build warnings and jsdom WebGL2/Node FFmpeg diagnostics remain non-failing.
- **Production build passed: 5,967 modules transformed.** Emitted JS/HTML audit found no retired voice/shader-authoring/credential/proxy entry points or provider URLs. Remaining Whisper/MediaPipe code is expected until Phase 3.
- **20 Node source/baseline checks passed.** Earlier phase guards were updated to accept deleted agent/function roots instead of reading removed files; historical baseline reports/fixtures/evidence were not rewritten.
- Retired-cloud-GPU check passed over **1,087 runtime source files**.

Focused/current regression coverage includes:

- No generation tab/speech entry/provider tabs or chat actions, while music/SFX, filters, titles, Recipes, audio mixer, portable edits and current manual navigation remain accessible.
- Real settings UI changes editing frame rate/background/autosave without provider requests; only manual preferences persist.
- Effect/fill/text shader controls still apply built-ins and edit parameters without generator controls. A saved generated fill loads into the registry, appears under its ordinary name and remains parameter-editable without requests.
- Existing generated-shader serializer/registry lifecycle and renderer tests remain. Existing creation scene editing/sync, manual transactions/undo/rollback, JSON/presets/relinking, captions, current project packaging/recovery, multi-track and export tests pass with agent packages physically absent.
- New `scripts/ai-removal-phase2.test.mjs` scans retained runtime source, desktop, public worker, server functions when present, package manifests, lockfile, aliases and deployment configuration. It checks deleted implementations and preserved content explicitly. It deliberately does **not** prohibit Phase 3's inference dependencies or generic shader/model terminology.

## Browser, shader and export evidence

Used installed headless Edge with a new disposable profile and SwiftShader, normal Vite isolation configuration and CDP instrumentation. Actual DOM clicks verified:

- **1440×900:** music, filter presets, titles and manual settings remain; no speech entry, provider tabs or generation controls.
- **390×844:** exactly **Timeline / Media / Edit** tabs, all switchable, then return to wide mode without chat.

Actual store/engine calls, with no mocked codecs or renderers, then:

1. Imported the existing two-second H.264/AAC video fixture and a WAV derived locally from its audio, verifying ordinary audio import at **48 kHz**.
2. Trimmed video In to **0.5s**, verified undo/redo, edited a second overlapping video track and an ordinary audio track, and exercised transform/keyframe/group/visibility/solo/mute/lock state. The extra tracks were hidden/muted as appropriate to keep the independently verified export deterministic.
3. Added a saved generated GLSL definition as ordinary project content; round-tripped it through project JSON and reloaded its registry. Rendered it using the actual WebGL2 renderer at an edited parameter value; pixel readback was **[204, 128, 0, 255]**, not the Canvas2D fallback.
4. Loaded the current project again, rendered a **640×360** preview and exported an MP4 through the browser engine. Independent ffprobe verification and full FFmpeg decode passed: **295,768 bytes**, **36 video frames**, **1.500000 seconds**, **640×360 H.264 at 24 fps**, **48 kHz stereo AAC**.

```sh
node apps/web/scripts/validate-browser-export.mjs verify trim-start .codex-audit/phase2/trimmed.mp4
```

The final browser run recorded **710 page requests**, target events, worker constructors, IndexedDB opens/deletes and storage reads. No retired chat/MCP web runtime, provider transport, generation request, vault initialization or old job-store read was observed. No database deletion or uncaught page exception occurred; an unrelated sentinel preference survived. Ordinary font/autosave/motion-preset/media databases and Blob/FFmpeg workers remain. Source guards complement URL observations; opaque Blob URLs alone do not prove worker contents. Separate production-preview probes covered the six intentional retired-route GET/POST requests; they are not counted as application-generated browser requests.

Raw logs are ignored `phase2-*.log`; disposable browser/probe harnesses, reports, WAV/MP4 and independent validation JSON are ignored under `.codex-audit/phase2/`. No browser dependency was installed. `README.md`, `CONTRIBUTING.md`, historical Phase 0/1A/1B/1C/partial-Phase-2 evidence and historical fixtures remain unchanged.

## Remaining work

Phase 3 still removes Whisper/browser speech recognition and segmentation; those features were not disabled or removed here. Phase 4 still audits remaining dependencies/assets and retires active AI documentation beyond the updated workspace map. Phase 5 still includes hand-driven file-picker/export-dialog/download testing and wider cross-browser/visual release checks. This completes **Phase 2**, not the application's entire AI-removal plan.
