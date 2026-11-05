import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8");
function files(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "dist", "build", ".wrangler", "test"].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const agents = /@openreel\/(?:agent(?:-runner)?|creation-agent|creation-schema)\b|packages\/(?:agent(?:-runner)?|creation-agent|creation-schema)(?:\/|["'])/;
const generation = /TextToSpeechPanel|useElevenLabsApi|useTtsActions|tts-store|GenerateShaderBox|generateAiShader|ai-shader|buildShaderAuthoringPrompt|llm-transport|api-proxy|secure-storage|onSessionLock|SERVICE_REGISTRY|configuredServices|defaultLlmProvider|defaultTtsProvider|cachedElevenLabs|favoriteVoices|favoriteModels|agentAutoConfirm|agentDryRun|mcpAutoAllowTrustedLocal|\/api\/proxy\/|openreel-secure|https?:\/\/(?:api\.)?(?:elevenlabs\.io|openai\.com|anthropic\.com|kie\.ai)\b/i;

test("web, desktop, server and retained packages have no agent or generative-service runtime", () => {
  const paths = ["apps/web/src", "apps/web/functions", "apps/web/public", "packages"]
    .flatMap((path) => files(resolve(root, path)))
    .filter((path) => /\.[cm]?[jt]sx?$/.test(path) && !/\.(?:test|spec)\./.test(path));
  assert.ok(paths.length > 500);
  for (const path of ["apps/web/src/App.tsx", "apps/web/src/main.tsx", "apps/web/public/sw.js", "packages/core/src/index.ts"]) {
    assert.ok(paths.includes(resolve(root, path)), path);
  }
  for (const path of paths) {
    const text = readFileSync(path, "utf8");
    assert.doesNotMatch(text, agents, relative(root, path));
    assert.doesNotMatch(text, generation, relative(root, path));
  }
});

test("generation, credential clients, server proxy and agent workspaces are deleted, not disabled", () => {
  for (const path of [
    "packages/agent", "packages/agent-runner", "packages/creation-agent", "packages/creation-schema",
    "apps/web/src/services/agent", "apps/web/src/services/ai-shader.ts", "apps/web/src/services/ai-shader-prompt.ts",
    "apps/web/src/services/ai-shader.test.ts", "apps/web/src/services/api-proxy.ts", "apps/web/src/services/secure-storage.ts",
    "apps/web/src/stores/tts-store.ts", "apps/web/src/motion/components/GenerateShaderBox.tsx",
    "apps/web/src/motion/components/GenerateShaderBox.test.tsx", "apps/web/src/components/editor/settings/ApiKeysPanel.tsx",
    "apps/web/src/components/editor/inspector/TextToSpeechPanel.tsx", "apps/web/src/components/editor/inspector/VoiceBrowser.tsx",
    "apps/web/src/components/editor/inspector/ModelSelector.tsx", "apps/web/src/components/editor/inspector/AudioResult.tsx",
    "apps/web/src/components/editor/inspector/EnhancedTextPreview.tsx", "apps/web/src/components/editor/inspector/tts-constants.ts",
    "apps/web/src/components/editor/inspector/tts-types.ts", "apps/web/src/components/editor/inspector/hooks/useElevenLabsApi.ts",
    "apps/web/src/components/editor/inspector/hooks/useTtsActions.ts", "apps/web/functions/api/proxy/[[catchall]].ts",
  ]) assert.equal(existsSync(resolve(root, path)), false, path);
});

test("workspace manifests, lockfile, aliases and deployment no longer configure agents or provider forwarding", () => {
  const configs = ["package.json", "tsconfig.base.json", "bun.lock", "apps/web/package.json", "apps/web/tsconfig.json",
    "apps/web/vite.config.ts", "apps/web/vitest.config.ts",
    "apps/web/public/_redirects", "apps/web/public/_headers", "apps/web/index.html",
    ...files(resolve(root, "packages")).filter((path) => /(?:package|tsconfig)\.json$/.test(path))];
  for (const path of configs) assert.doesNotMatch(read(path), agents, path);
  for (const path of ["apps/web/public/_redirects", "apps/web/index.html"]) {
    assert.doesNotMatch(read(path), generation, path);
  }
  assert.match(read("apps/web/public/_headers"), /Cross-Origin-Opener-Policy: same-origin/);
  assert.match(read("apps/web/public/_headers"), /Cross-Origin-Embedder-Policy: require-corp/);
  for (const header of ["Cross-Origin-Opener-Policy", "Cross-Origin-Embedder-Policy"]) assert.ok(read("apps/web/vite.config.ts").includes(header));
  const patches = JSON.parse(read("package.json")).patchedDependencies;
  assert.ok(patches["@ffmpeg/core@0.12.6"]);
  assert.ok(patches["@ffmpeg/core-mt@0.12.6"]);
});

test("manual content remains; settings have no provider or vault controls", () => {
  for (const path of [
    "apps/web/src/components/editor/ScriptViewDialog.tsx", "apps/web/src/components/editor/EditSharingPanel.tsx",
    "apps/web/src/services/editing/portable-edits.ts", "apps/web/src/services/editing/creation-sync.ts",
    "apps/web/src/services/share-service.ts", "apps/web/src/config/api-endpoints.ts", "apps/web/src/services/export-presets.ts",
    "apps/web/src/motion/components/CreationWorkspacePanel.tsx", "apps/web/src/components/editor/inspector/ShaderControls.tsx",
    "packages/core/src/motion/shaders/registry.ts", "packages/core/src/motion/motion-shader-validator.ts",
    "packages/core/src/creation/index.ts", "packages/creation-core/package.json", "packages/creation-bindings/package.json", "packages/fxpkg/package.json",
    "apps/web/src/components/editor/inspector/CaptionEditorPanel.tsx",
  ]) assert.ok(existsSync(resolve(root, path)), path);
  const dialog = read("apps/web/src/components/editor/settings/SettingsDialog.tsx");
  assert.match(dialog, /<GeneralPanel/);
  assert.doesNotMatch(dialog, /API Keys|MCP|AI Editor|TabsTrigger|settingsTab/);
  assert.doesNotMatch(read("apps/web/src/stores/settings-store.ts"), /provider|llm|favorite|cached|session|secret|SettingsTab/i);
  assert.match(read("apps/web/src/config/api-endpoints.ts"), /export const OPENREEL_CLOUD_URL\b/);
  assert.match(read("apps/web/src/services/share-service.ts"), /OPENREEL_CLOUD_URL/);
});
