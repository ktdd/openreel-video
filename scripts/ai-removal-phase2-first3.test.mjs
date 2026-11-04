import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8");
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

test("web runtime has no chat, MCP editing, Kie generation, polling or job-state entry point", () => {
  const paths = files(resolve(root, "apps/web/src"))
    .filter((path) => /\.(?:[cm]?[jt]sx?|css)$/.test(path) && !/\.(?:test|spec)\./.test(path) && !path.includes(`${resolve(root, "apps/web/src/test")}`));
  assert.ok(paths.length > 300);
  for (const path of ["apps/web/src/App.tsx", "apps/web/src/desktop/DesktopApp.tsx", "apps/web/src/stores/ui-store.ts"]) {
    assert.ok(paths.includes(resolve(root, path)), path);
  }
  const retired = /agentChat|ChatPanel|useChatStore|useChatHistoryStore|useAIConnectionStore|chat-history-store|chat-store|ai-connection-store|\bmcp\b|installMcpListener|OpenReelMcpStatus|mcpAutoAllowTrustedLocal|agentAutoConfirm|agentDryRun|ai-workspace|ai-chat-resizer|KieAI|kieai|kie-ai|kie\.ai|AIGenTab|addPlaceholderMedia|replacePlaceholderMedia|setKieAIItemState/i;
  for (const path of paths) assert.doesNotMatch(readFileSync(path, "utf8"), retired, relative(root, path));
  assert.doesNotMatch(read("packages/core/src/types/project.ts"), /kieai|isPending/);
});

test("removed chat and generation implementations are deleted rather than hidden", () => {
  for (const path of [
    "apps/web/src/components/editor/chat",
    "apps/web/src/components/editor/kieai",
    "apps/web/src/components/editor/AIGenTab.tsx",
    "apps/web/src/components/editor/ai-workspace.css",
    "apps/web/src/stores/chat-store.ts",
    "apps/web/src/stores/chat-history-store.ts",
    "apps/web/src/stores/ai-connection-store.ts",
    "apps/web/src/stores/kieai-store.ts",
    "apps/web/src/hooks/useKieAIPoller.ts",
    "apps/web/src/services/kieai",
    "apps/web/src/services/agent/mcp-listener.ts",
    "apps/web/src/services/agent/live-host.ts",
    "apps/web/src/services/agent/editing-session.ts",
    "apps/web/src/services/agent/editing-tools.ts",
    "apps/web/src/services/agent/direct-llm-transport.ts",
    "apps/web/src/services/agent/model-discovery.ts",
    "apps/web/src/components/editor/settings/AIConnectionPanel.tsx",
    "apps/web/src/components/editor/settings/AISettingsPanel.tsx",
    "apps/web/src/components/editor/settings/McpPanel.tsx",
  ]) assert.equal(existsSync(resolve(root, path)), false, path);
  assert.equal(existsSync(resolve(root, "apps/web/src/services/agent")), false);
});

test("manual layout and media tools are retained", () => {
  const assets = read("apps/web/src/components/editor/AssetsPanel.tsx");
  for (const name of ["MusicLibraryPanel", "FilterPresetsPanel", "RecipesTab", "generateBackgroundBlob", "replaceMediaAsset"]) assert.ok(assets.includes(name), name);
  assert.match(read("apps/web/src/components/editor/editor-responsive.css"), /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  for (const path of [
    "apps/web/src/components/editor/EditSharingPanel.tsx",
    "apps/web/src/services/editing/portable-edits.ts",
    "apps/web/src/services/editing/creation-sync.ts",
    "apps/web/src/components/editor/inspector/CaptionEditorPanel.tsx",
  ]) assert.ok(existsSync(resolve(root, path)), path);
});
