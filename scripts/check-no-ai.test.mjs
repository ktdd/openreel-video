import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { checkNoAI } from "./check-no-ai.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
function fixture(t) {
  const dir = mkdtempSync(resolve(tmpdir(), "openreel-no-ai-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { dir, write(path, contents) { const file = resolve(dir, path); mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, contents); } };
}

test("current runtime, configuration and server sources pass the consolidated guard", () => {
  const result = checkNoAI(root);
  assert.deepEqual(result.failures, []);
  assert.ok(result.scanned > 700);
});
for (const [label, path, content] of [
  ["inference import", "apps/web/src/worker.ts", 'import { pipeline } from "@huggingface/transformers";'],
  ["transitive inference package", "bun.lock", '"onnxruntime-web": ["onnxruntime-web@1"]'],
  ["provider dependency", "packages/tools/package.json", '{"dependencies":{"@anthropic-ai/sdk":"1"}}'],
  ["workspace alias", "apps/web/tsconfig.json", '{"paths":{"@openreel/agent":["../../packages/agent/src"]}}'],
  ["backend provider forwarding", "apps/web/functions/api/generate.ts", 'fetch("https://api.openai.com/v1/responses")'],
  ["preconnect model URL", "apps/web/index.html", '<link rel="preconnect" href="https://huggingface.co">'],
  ["CSP provider URL", "apps/web/public/_headers", "Content-Security-Policy: connect-src https://api.elevenlabs.io"],
  ["caption environment config", "apps/web/.env.example", "MODEL=https://hf.co/whisper/model"],
  ["API proxy route", "apps/web/public/_redirects", "/api/proxy/* https://example.invalid/:splat 200"],
  ["recognition declaration", "apps/web/src/types/global.d.ts", "interface SpeechRecognition {}"],
  ["invisible cleanup module", "apps/web/src/services/retirement.ts", 'localStorage.removeItem("tts-store")'],
  ["segmentation state", "packages/core/src/types/text.ts", "behindSubject?: boolean;"],
  ["multicam workflow", "packages/core/src/editing/camera.ts", "function analyzeMulticam() {}"],
  ["desktop bridge", "apps/web/src/main.tsx", "window.openreel?.platform"],
  ["desktop build flag", "apps/web/vite.config.ts", "process.env.OPENREEL_DESKTOP"],
  ["desktop ambient contract", "apps/web/src/types/global.d.ts", 'interface Window { openreel?: { platform: "desktop" } }'],
  ["native menu listener", "apps/web/src/editor.ts", 'window.addEventListener("openreel:menu:export", cb)'],
  ["side-effect fixture import", "apps/web/src/loader.ts", 'import "./test/fixtures/ai-removal-browser-state.json";'],
  ["dormant desktop UI", "apps/web/src/desktop/Unused.tsx", "export const unused = true;"],
  ["dormant agent workspace", "packages/creation-agent/package.json", "{}"],
  ["inference model", "apps/web/public/weights/person.tflite", "binary"],
  ["unknown fixture copy", "apps/web/src/test/fixtures/copied.json", '{"behindSubject":true}'],
  ["runtime fixture import", "apps/web/src/loader.ts", 'import data from "./test/fixtures/ai-removal-browser-state.json";'],
  ["runtime test-module import", "apps/web/src/main.tsx", 'import "./retired.test";'],
]) test(`rejects ${label}`, (t) => {
  const f = fixture(t); f.write(path, content);
  const result = checkNoAI(f.dir);
  assert.ok(result.failures.length, `${label} was not detected`);
  assert.ok(result.failures.some((failure) => failure.startsWith(path) || path.startsWith(`${failure.split(":")[0]}/`)), result.failures.join("\n"));
});

test("retained content and unrelated networking are not blanket AI false positives", (t) => {
  const f = fixture(t);
  f.write("apps/web/src/content.ts", 'const model = "asset.glb"; const generatedShaders = []; const mask = {}; const shader = "void main(){}"; fetch("https://api.openreel.video/shares/1");');
  f.write("packages/core/src/creation/kernel.cpp", "// deterministic native/WASM/CPU model and mask geometry");
  f.write("packages/core/src/creation/package.json", '{"dependencies":{"@paper-design/shaders":"1","three":"1","mediabunny":"1","gsap":"1"}}');
  f.write("apps/web/public/sw.js", 'const CACHE = "media"; fetch("/api/shares/1");');
  f.write("apps/web/public/scene.gltf", '{"asset":{"version":"2.0"}}');
  assert.deepEqual(checkNoAI(f.dir).failures, []);
});

test("only explicit historical data and non-runtime artifacts are excluded", (t) => {
  const f = fixture(t);
  for (const path of ["apps/web/src/test/fixtures/ai-removal-browser-state.json", "packages/core/src/test/fixtures/ai-removal/legacy-ai-project.json",
    "apps/web/src/removal.test.ts", "apps/web/vite.config.ts.timestamp-123-abcdef.mjs", "apps/web/dist/old.js", "apps/web/node_modules/old/index.js", "docs/history.md"]) f.write(path, "behindSubject SpeechRecognition @openreel/agent");
  mkdirSync(resolve(f.dir, "apps/web/src/desktop"), { recursive: true });
  assert.deepEqual(checkNoAI(f.dir).failures, []);
});

test("browser entry/configuration and manual export have no desktop-only branch", () => {
  const read = (path) => readFileSync(resolve(root, path), "utf8");
  assert.match(read("apps/web/src/main.tsx"), /<App\s*\/>/);
  assert.doesNotMatch(read("apps/web/src/main.tsx"), /React\.lazy|setEncoderBackendFactory|NativeFFmpeg/);
  assert.doesNotMatch(read("apps/web/vite.config.ts"), /desktopHtml|stripFfmpeg|pruneFonts|OPENREEL_DESKTOP/);
  assert.match(read("apps/web/src/services/export-runner.ts"), /showSaveFilePicker/);
  assert.match(read("apps/web/src/services/project-manager.ts"), /showOpenFilePicker|showSaveFilePicker/);
  assert.match(read("packages/core/src/media/extract-audio.ts"), /ffmpeg-fallback/);
  for (const path of ["packages/creation-core/package.json", "packages/creation-bindings/package.json", "packages/core/src/creation/render/render.test.ts"]) assert.ok(read(path));
});

test("audited unused packages are pruned, shared content/render dependencies remain", () => {
  const web = JSON.parse(readFileSync(resolve(root, "apps/web/package.json"), "utf8"));
  const core = JSON.parse(readFileSync(resolve(root, "packages/core/package.json"), "utf8"));
  for (const name of ["react-markdown", "remark-gfm", "@gsap/react", "@paper-design/shaders-react", "idb-keyval"]) {
    assert.equal(web.dependencies[name], undefined, name);
    assert.equal(core.dependencies[name], undefined, name);
  }
  assert.ok(web.dependencies["react-syntax-highlighter"]);
  for (const name of ["gsap", "@paper-design/shaders", "mediabunny", "three", "@ffmpeg/ffmpeg"]) assert.ok(core.dependencies[name], name);
});

test("active docs retire agent setup and point to the manual editor", () => {
  for (const path of ["docs/AGENT-GUIDE.md", "docs/AGENT-CAPABILITIES.md", "docs/ai-editing.md"]) {
    const text = readFileSync(resolve(root, path), "utf8");
    assert.match(text, /Retired/);
    assert.doesNotMatch(text, /verify-ai-workspace|agent-runner run|Connect a model/);
    assert.match(text, /editor-workflows\.md/);
  }
  assert.match(readFileSync(resolve(root, "docs/superpowers/README.md"), "utf8"), /retired/);
});

test("root check preserves the independent cloud-GPU guard and frozen FFmpeg patches", () => {
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  assert.match(pkg.scripts["check:no-ai"], /check-no-ai\.mjs.*&&.*check-retired-cloud-gpu\.mjs/);
  assert.equal(pkg.scripts["check:retired-cloud-gpu"], "node scripts/check-retired-cloud-gpu.mjs");
  for (const key of ["@ffmpeg/core@0.12.6", "@ffmpeg/core-mt@0.12.6"]) assert.ok(pkg.patchedDependencies[key]);
  assert.ok(pkg.devDependencies["@types/node"], "test/tooling types must not rely on stale hoists");
  const config = JSON.parse(readFileSync(resolve(root, "tsconfig.base.json"), "utf8"));
  assert.ok(config.compilerOptions.lib.includes("ESNext.Disposable"));
});
