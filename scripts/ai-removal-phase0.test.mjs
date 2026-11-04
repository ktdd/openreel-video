import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { test } from "node:test";
import { findModuleReferences, measureBundle, summarizeHar } from "./ai-removal-phase0.mjs";

const entry = (url, status = 200) => ({
  request: { url, headers: [{ name: "Authorization", value: "secret-header" }], postData: { text: "secret-project" } },
  response: { status, _transferSize: 12, content: { size: 20, text: "secret-response" } },
  startedDateTime: "2026-01-01T00:00:00Z",
  time: 10,
});

test("HAR summary removes credentials, paths, queries, headers, bodies and initiators", () => {
  const report = summarizeHar({ log: { entries: [
    entry("https://secret-username:secret-password@example.com/private-project?key=secret-query#secret-fragment"),
    entry("blob:http://localhost:5173/private-blob-id"),
  ] } });
  const json = JSON.stringify(report);
  for (const secret of ["secret-username", "secret-password", "private-project", "secret-query", "secret-fragment", "secret-header", "secret-project", "secret-response", "private-blob-id"]) assert.ok(!json.includes(secret), secret);
  assert.equal(report.requests, 2);
  assert.equal(report.reportedTransferBytes, 24);
  assert.deepEqual(report.origins.map((origin) => origin.origin), ["blob:[redacted]", "https://example.com"]);
});

test("Vite source modules are distinct from provider/model requests", () => {
  const report = summarizeHar({ log: { entries: [
    entry("http://localhost:5173/src/workers/whisper-worker.ts"),
    entry("http://localhost:5173/node_modules/.vite/deps/@huggingface_transformers.js?v=private"),
    entry("https://huggingface.co/synthetic/model.onnx"),
    entry("http://127.0.0.1:5173/api/proxy/openai/chat/completions"),
    entry("https://fonts.example.com/font.woff2", 404),
    entry("not-a-url", 0),
  ] } });
  assert.equal(report.categories["local-development-module"], 2);
  assert.equal(report.categories["ai-provider-or-model-candidate"], 2);
  assert.equal(report.categories["external-http"], 1);
  assert.equal(report.categories["non-http"], 1);
  assert.equal(report.statuses["404"], 1);
  assert.equal(report.statuses["0"], 1);
  assert.equal(report.captureSpanMs, 10);
});

test("HAR validation and missing size handling", () => {
  assert.throws(() => summarizeHar({}), /log.entries/);
  const report = summarizeHar({ log: { entries: [{ request: { url: "http://localhost" } }] } });
  assert.equal(report.missingTransferSizes, 1);
  assert.equal(report.reportedTransferBytes, 0);
  assert.equal(report.captureSpanMs, null);
  assert.equal(summarizeHar({ log: { entries: [] } }).requests, 0);
});

test("inventory parser finds real import forms, mocks and worker URLs, not comments", () => {
  const ts = createRequire(new URL("../apps/web/package.json", import.meta.url))("typescript");
  const source = `// import "comment-only";
import type { Host } from "@openreel/agent";
export * from "./agent/index";
const runtime = import("onnxruntime-web");
type Model = import("@mediapipe/tasks-vision").ImageSegmenter;
const client = require("./api-proxy");
vi.mock("./llm-transport");
const worker = new URL("./whisper-worker.ts", import.meta.url);
const notAnImport = "import('string-only')";`;
  const matches = findModuleReferences(ts, "fixture.ts", source);
  assert.deepEqual(matches.map((match) => match.module), ["@openreel/agent", "./agent/index", "onnxruntime-web", "@mediapipe/tasks-vision", "./api-proxy", "./llm-transport", "./whisper-worker.ts"]);
  assert.equal(matches[0].line, 2);
});

test("bundle totals distinguish emitted assets from copied public files", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "openreel-phase0-"));
  try {
    assert.throws(() => measureBundle(directory), /Build the web app first/);
    mkdirSync(resolve(directory, "assets"));
    writeFileSync(resolve(directory, "index.html"), "entry");
    writeFileSync(resolve(directory, "assets/worker.js"), "const worker = true;");
    writeFileSync(resolve(directory, "font.woff2"), "public-font");
    const report = measureBundle(directory);
    assert.equal(report.totalDistFiles, 3);
    assert.equal(report.emittedFiles, 2);
    assert.equal(report.emittedBytes, 25);
    assert.equal(report.totalDistBytes, 36);
    assert.equal(report.byExtension[".js"].files, 1);
    assert.ok(report.assets.every((asset) => asset.sha256.length === 64 && asset.gzipBytes > 0));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
