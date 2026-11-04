import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

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
const retired = /whisper-worker|whisper-models|whisper-audio|AutoCaptionPanel|SpeechRecognition|SpeechToTextEngine|speech-to-text-engine|BackgroundRemovalEngine|BackgroundRemovalSection|background-removal|BehindSubjectSection|behindSubject|text-behind-subject|PersonSegmentation|person-segmentation|SegmentationResult|subjectMaskRequestCache|subjectOcclusionMaskCache|captureSubjectFrame|createMotionAwareOcclusionMask|temporal-person-mask|\bAiTab\b|isAIAvailable|isAIRequest|AI_OFFLINE|@huggingface\/transformers|@mediapipe\/tasks-vision|onnxruntime|https?:\/\/(?:huggingface\.co|hf\.co)|mediapipe-models|selfie_segmenter|vision_bundle|multicam|silero|face_landmarker|\.orma\b|\botio\b/i;

test("preview, export, captions and all retained runtimes have no inference or retired multicam paths", () => {
  const paths = ["apps/web/src", "apps/web/public", "apps/web/functions", "packages"]
    .flatMap((path) => files(resolve(root, path)))
    .filter((path) => /\.(?:[cm]?[jt]sx?|css|html)$/.test(path) && !/\.(?:test|spec)\./.test(path));
  assert.ok(paths.length > 500);
  for (const path of ["apps/web/src/components/editor/Preview.tsx", "apps/web/src/components/editor/preview/canvas-renderers.ts",
    "packages/core/src/video/video-engine.ts", "apps/web/public/sw.js"]) assert.ok(paths.includes(resolve(root, path)), path);
  for (const path of paths) assert.doesNotMatch(readFileSync(path, "utf8"), retired, relative(root, path));
  assert.doesNotMatch(read("packages/core/src/index.ts"), /export .*['"]\.\/ai['"]/);
  assert.doesNotMatch(read("apps/web/src/components/editor/inspector/clip-tabs.config.ts"), /['"]ai['"]/);
});

test("recognition and segmentation implementations and their success-path tests are deleted", () => {
  for (const path of [
    "packages/core/src/ai", "packages/core/src/text/speech-to-text-engine.ts", "packages/core/src/multicam",
    "apps/web/src/workers/whisper-worker.ts", "apps/web/src/workers/whisper-models.ts", "apps/web/src/utils/whisper-audio.ts",
    "apps/web/src/utils/whisper-audio.test.ts", "apps/web/src/components/editor/inspector/AutoCaptionPanel.tsx",
    "apps/web/src/components/editor/inspector/BackgroundRemovalSection.tsx", "apps/web/src/components/editor/inspector/BehindSubjectSection.tsx",
    "apps/web/src/components/editor/inspector/tabs/AiTab.tsx", "apps/web/src/services/multicam-transcription.ts",
  ]) assert.equal(existsSync(resolve(root, path)), false, path);
  for (const path of files(resolve(root, "apps/web/public"))) assert.doesNotMatch(path, /\.(?:onnx|tflite)$/i, path);
});

test("inference libraries are absent from manifests and regenerated lockfile", () => {
  const manifests = ["package.json", "apps/web/package.json", ...files(resolve(root, "packages")).filter((path) => path.endsWith("package.json"))];
  for (const path of [...manifests, "bun.lock"]) {
    assert.doesNotMatch(read(path), /@huggingface\/transformers|@mediapipe\/tasks-vision|onnxruntime(?:-web|-node|-common)?/i, path);
  }
});

test("caption content, ordinary graphics/audio/effects and creation backends remain", () => {
  for (const path of [
    "packages/core/src/text/transcript-types.ts", "packages/core/src/text/subtitle-engine.ts", "packages/core/src/text/title-engine.ts",
    "packages/core/src/video/auto-reframe-engine.ts", "packages/core/src/video/mask-engine.ts", "packages/core/src/video/chroma-key-engine.ts",
    "packages/core/src/motion/shaders/registry.ts", "packages/core/src/creation/index.ts", "packages/creation-core/package.json",
    "packages/creation-bindings/package.json", "packages/fxpkg/package.json", "packages/core/src/editing-templates/registry.ts",
    "apps/web/src/components/editor/inspector/ManualEditingSections.tsx", "apps/web/src/components/editor/inspector/CaptionEditorPanel.tsx",
    "apps/web/src/components/editor/inspector/GreenScreenSection.tsx", "apps/web/src/services/export-presets.ts",
    "apps/web/src/services/share-service.ts", "apps/web/src/services/editing/creation-sync.ts",
  ]) assert.ok(existsSync(resolve(root, path)), path);
  assert.match(read("packages/core/src/text/index.ts"), /\.\/transcript-types/);
  for (const name of ["TranscriptionSegment", "TranscriptionResult"]) assert.ok(read("packages/core/src/text/transcript-types.ts").includes(name));
  for (const name of ["renderOverlayLayerWithEffects", "renderTextClipWithEffects", "renderShapeClipWithEffects", "preparePreviewFrame", "renderTransitionCanvas", "renderAllLayersWithGPU"]) {
    assert.ok(read("apps/web/src/components/editor/Preview.tsx").includes(name), name);
  }
});

test("service worker retains static caching and optional API networking, not an AI availability protocol", async () => {
  const handlers = new Map();
  const requests = [];
  let online = true;
  const puts = [];
  const cache = { put: async (...args) => { puts.push(args); } };
  runInNewContext(read("apps/web/public/sw.js"), {
    self: { addEventListener: (name, handler) => handlers.set(name, handler) }, URL, Response,
    console: { log() {}, warn() {}, error() {} },
    caches: { match: async () => undefined, open: async () => cache },
    fetch: async (request) => { requests.push(request.url); if (!online) throw new Error("Offline"); return new Response("local response"); },
  });
  assert.equal(requests.length, 0);
  let response;
  const waits = [];
  const dispatch = (url) => handlers.get("fetch")({ request: { url, method: "GET", mode: "cors" },
    respondWith: (promise) => { response = promise; }, waitUntil: (promise) => waits.push(promise) });
  dispatch("https://editor.invalid/assets/editor.js");
  assert.equal(await (await response).text(), "local response");
  await Promise.all(waits);
  assert.equal(puts.length, 1);
  dispatch("https://editor.invalid/api/shares/example");
  assert.equal(await (await response).text(), "local response");
  assert.equal(puts.length, 1);
  online = false;
  dispatch("https://editor.invalid/api/shares/example");
  const offline = await response;
  assert.equal(offline.status, 503);
  assert.equal((await offline.json()).error, "NETWORK_UNAVAILABLE");
});
