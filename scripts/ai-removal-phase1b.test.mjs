import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8");
test("retained manual editing surfaces do not depend on agents or chat state", () => {
  const paths = [
    "apps/web/src/components/editor/EditSharingPanel.tsx",
    "apps/web/src/motion/components/CreationWorkspacePanel.tsx",
    "apps/web/src/components/editor/inspector/ManualEditingSections.tsx",
    "packages/core/src/creation/creation-to-motion.ts",
    "packages/core/src/video/auto-reframe-engine.ts",
    ...readdirSync(resolve(root, "apps/web/src/services/editing")).filter((name) => name.endsWith(".ts") && !name.includes(".test.")).map((name) => `apps/web/src/services/editing/${name}`),
  ];
  for (const path of paths) {
    assert.doesNotMatch(read(path), /(?:from\s+["'][^"']*(?:@openreel\/agent|services\/agent)|executeTool\(|executeEditingTool\(|useChatStore|suggestedNextTools)/, path);
  }
  assert.ok(read("apps/web/src/components/editor/ProjectPackageDialog.tsx").includes("<EditSharingPanel"));
  assert.equal(existsSync(resolve(root, "apps/web/src/components/editor/chat/ChatPanel.tsx")), false);
});
test("heuristic reframe and agent-only inspection have been disentangled", () => {
  assert.equal(existsSync(resolve(root, "packages/core/src/ai/auto-reframe-engine.ts")), false);
  assert.equal(existsSync(resolve(root, "apps/web/src/motion/model-inspection.ts")), false);
  assert.ok(read("packages/core/src/video/index.ts").includes('"./auto-reframe-engine"'));
  assert.equal(existsSync(resolve(root, "packages/agent")), false);
});
