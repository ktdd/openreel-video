import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { retiredResource, retiredUI, validateRelease } from "./validate-ai-removal-release.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("release network assertions detect attempted retired requests, not only successful responses", () => {
  for (const url of [
    "https://api.openai.com/v1/chat/completions", "https://api.elevenlabs.io/v1/text-to-speech/id",
    "https://kie.ai/tasks", "https://huggingface.co/models/weights.onnx", "/api/proxy/openai",
    "/src/workers/whisper-worker.ts", "/workers/person-segmentation.js", "/multicam-analysis-worker.js",
    "/node_modules/onnxruntime-web/ort.wasm", "/mediapipe/vision_bundle.js", "/services/agent/host.ts",
  ]) assert.ok(retiredResource.test(url), url);
  for (const url of [
    "/fonts/Inter.woff2", "/assets/ffmpeg-worker.js", "blob:http://localhost/media-decoder",
    "/models/manual-scene.glb", "/shaders/gradient.wgsl", "/services/sharing-service.ts",
    "/video/auto-reframe-engine.ts", "/editing-templates/recipes.ts",
  ]) assert.equal(retiredResource.test(url), false, url);
});

test("retired navigation assertions preserve manual editor labels", () => {
  for (const label of ["Multi-Camera Editing", "Screen recorder", "Editor tour", "Auto Captions", "Save as Template", "Text to Speech"])
    assert.ok(retiredUI.test(label), label);
  assert.equal(retiredUI.test("Recipes Export presets Captions Chroma key Motion Project backups"), false);
});

test("retained creation tests use current-format content rather than historical AI state", () => {
  for (const path of ["apps/web/src/services/editing/creation-sync.test.ts", "packages/core/src/creation/creation-to-motion.test.ts"]) {
    const source = read(path);
    assert.ok(source.includes("fixtures/current-project.json"));
    assert.equal(source.includes("legacy-ai-project"), false);
  }
  const project = JSON.parse(read("packages/core/src/test/fixtures/current-project.json"));
  assert.equal(project.mediaLibrary.items.length, 1);
  assert.equal(project.timeline.subtitles[0].text, "Manual caption");
  assert.equal(project.motionCompositions[0].layers[0].variableBindings[0].target, "text.content");
  assert.equal(project.creation.scenes[0].renderBindings[0].layerId, "creation-layer");
  assert.equal(project.generatedShaders[0].origin, "generated");
  assert.equal(/kieai|behindSubject|isPending|whisper|multicam|agent-created/i.test(JSON.stringify(project)), false);
});

test("browser gate is opt-in, dependency-free and writes only ignored verification outputs", async () => {
  await assert.rejects(validateRelease({ directory: "release-output" }), /under .codex-audit/);
  const manifest = JSON.parse(read("package.json"));
  assert.ok(manifest.scripts["check:release-browser"].includes("--compact"));
  const source = read("scripts/validate-ai-removal-release.mjs");
  assert.equal(/from ["'](?:playwright|puppeteer)/.test(source), false);
  for (const requirement of ["Network.requestWillBeSent", "Target.setAutoAttach", "waitForDebuggerOnStart: true", "Network.setBlockedURLs", "Network.emulateNetworkConditions", "DOM.setFileInputFiles", "Page.reload", "validate-browser-export.mjs", "probe.permissions", "probe.deletes"])
    assert.ok(source.includes(requirement), requirement);
});
