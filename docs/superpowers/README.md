# Historical design archive — superseded product scope

The documents under `plans/` and `specs/` record earlier designs, proposals and implementation notes. They are **not current feature documentation or instructions to restore removed systems**. Current scripts/source, [the removal plan](../remove-ai-features.md) and [manual editor workflows](../editor-workflows.md) are authoritative.

## Retired / superseded portions

All AI chat/agent/MCP/headless-runner, provider/keychain/generation, model-download/transcription/segmentation, multicam, desktop app/IPC, landing/template-browser, screen-recording and tour instructions anywhere in this archive are retired. In particular this applies to:

- `2026-05-18-v2.0-on-device-ai`, `2026-05-18-openreel-v2-ecosystem-design`.
- `2026-05-27-studio-redesign`, `2026-05-28-phase-0-workspace-scaffolding`, `2026-05-30-inspector-redesign` and their design variants where they discuss removed UI.
- All `desktop` / `electron` plans/specs, including BYOK/keychain, native media offload, MCP, export and window/start-screen designs.
- `2026-06-18-ai-agent-editing-design` and the `2026-06-18-phase0` through `phase5` agent-program plans/status notes.
- The agent-facing portions of `2026-06-25-agent-native-creation-engine` and desktop IPC portions of `2026-06-27-native-render-engine`.
- Prompt generation/agent tools in `2026-07-01-ai-generated-shaders` and MCP tools in `2026-07-01-motion-mcp-shader-scene3d-exposure`, including their design variants.
- Incidental AI/agent/desktop references in later shader, scene3D, timeline, path, expression, graph-editor and render-queue designs. A reference to an old agent tool is not a live manual workflow.

## Retained deterministic work

Do **not** infer that every feature in a mixed historical document was removed. Creation C++/WASM/CPU engines, scene conversion/synchronization, GLSL definitions/validation/rendering, variable bindings, manual motion/3D editing, keyframes, audio analysis, effects, Recipes, export presets and ordinary project persistence remain. Their current implementations/tests define support, not historical TODOs or completion claims.

Original dated document bodies are retained. Prominent notices on AI/desktop-centered documents point back here; none of this archive is an active acceptance checklist for the manual-only fork.
