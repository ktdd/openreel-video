import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
function files(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "dist", "build", ".wrangler"].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const retired = /multicam|multi[- ]camera editing|silero|face_landmarker|\.orma\b|\botio\b/i;
test("runtime sources have no multicam UI, engine, storage, worker, model or host surface", () => {
  const paths = ["apps/web/src", "packages", "apps/web/functions"]
    .flatMap((directory) => files(resolve(root, directory)))
    .filter((path) => /\.[cm]?[jt]sx?$/.test(path) && !/\.(?:test|spec)\./.test(path));
  assert.ok(paths.length > 500);
  for (const path of ["apps/web/src/App.tsx", "packages/core/src/index.ts"]) {
    assert.ok(paths.includes(resolve(root, path)), path);
  }
  for (const path of paths) {
    assert.doesNotMatch(relative(root, path), retired);
    assert.doesNotMatch(readFileSync(path, "utf8"), retired, relative(root, path));
  }
});
test("retired implementations and their feature-success tests are deleted, not stubbed", () => {
  for (const path of [
    "packages/core/src/multicam",
    "packages/core/src/video/multicam-engine.ts",
    "packages/core/src/actions/handlers/multicam.ts",
    "packages/agent/src/registry.multicam.test.ts",
    "apps/web/src/components/editor/inspector/MultiCameraPanel.tsx",
    "apps/web/src/components/editor/inspector/multicam-workflow.ts",
    "apps/web/src/services/multicam-analysis-store.ts",
    "apps/web/src/services/multicam-transcription.ts",
    "apps/web/src/services/multicam-face-reactions.ts",
    "apps/web/src/services/agent/multicam-bridge.ts",
    "apps/web/src/workers/multicam-analysis-worker.ts",
  ]) assert.equal(existsSync(resolve(root, path)), false, path);
});
test("multicam-only direct dependencies are removed without dropping shared media dependencies", () => {
  const { dependencies } = JSON.parse(readFileSync(resolve(root, "packages/core/package.json"), "utf8"));
  assert.equal(dependencies["onnxruntime-web"], undefined);
  assert.equal(dependencies.yaml, undefined);
  for (const name of ["mediabunny", "@ffmpeg/ffmpeg"]) {
    assert.ok(dependencies[name], name);
  }
});
