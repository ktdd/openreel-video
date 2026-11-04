import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const slash = (path) => path.replaceAll("\\", "/");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sortedCounts = (values) => Object.fromEntries(
  [...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length]),
);

export function summarizeHar(har) {
  if (!Array.isArray(har?.log?.entries)) throw new Error("Expected HAR log.entries");
  const rows = har.log.entries.map((entry) => {
    let url;
    try { url = new URL(entry.request.url); } catch { /* Report malformed URLs without copying them. */ }
    const isHttp = url && ["http:", "https:"].includes(url.protocol);
    const local = url && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const localSource = local && /^\/(?:src\/|@fs\/|@id\/|@vite\/|@react-refresh|node_modules\/)/.test(url.pathname);
    const provider = isHttp && !local && /(?:openai|anthropic|elevenlabs|kie\.ai|freepik|huggingface|hf\.co|mediapipe|silero)/i.test(url.hostname + url.pathname);
    const model = isHttp && !localSource && /\.(?:onnx|tflite)(?:$|\/)|ort-wasm|transformers|whisper|person-segmentation/i.test(url.pathname);
    const proxy = local && url.pathname.startsWith("/api/proxy/");
    return {
      // Deliberately exclude paths, query strings, headers, bodies, cookies, and initiator stacks.
      origin: isHttp ? url.origin : `${url?.protocol ?? "invalid:"}[redacted]`,
      category: localSource ? "local-development-module" : provider || model || proxy ? "ai-provider-or-model-candidate" : local ? "local-http" : isHttp ? "external-http" : "non-http",
      status: Number(entry.response?.status ?? 0),
      resourceType: entry._resourceType ?? "unknown",
      transferBytes: Number.isFinite(entry.response?._transferSize) && entry.response._transferSize >= 0 ? entry.response._transferSize : null,
      contentBytes: Number.isFinite(entry.response?.content?.size) && entry.response.content.size >= 0 ? entry.response.content.size : null,
      started: Date.parse(entry.startedDateTime),
      durationMs: Number(entry.time ?? 0),
    };
  });
  const times = rows.filter((row) => Number.isFinite(row.started));
  return {
    privacy: "Aggregate only; no URL paths/queries, headers, cookies, request/response bodies, or initiator stacks.",
    limitation: "One user-supplied browser session, not proof of AI absence. Local source-module downloads are not inference or provider calls. Candidate classification is heuristic.",
    requests: rows.length,
    captureSpanMs: times.length ? Math.max(...times.map((row) => row.started + Math.max(0, row.durationMs))) - Math.min(...times.map((row) => row.started)) : null,
    categories: sortedCounts(rows.map((row) => row.category)),
    statuses: sortedCounts(rows.map((row) => String(row.status))),
    resourceTypes: sortedCounts(rows.map((row) => row.resourceType)),
    reportedTransferBytes: rows.reduce((sum, row) => sum + (row.transferBytes ?? 0), 0),
    missingTransferSizes: rows.filter((row) => row.transferBytes === null).length,
    reportedContentBytes: rows.reduce((sum, row) => sum + (row.contentBytes ?? 0), 0),
    origins: [...new Set(rows.map((row) => row.origin))].sort().map((origin) => {
      const matches = rows.filter((row) => row.origin === origin);
      return { origin, requests: matches.length, statuses: sortedCounts(matches.map((row) => String(row.status))), categories: sortedCounts(matches.map((row) => row.category)) };
    }),
  };
}

export function findModuleReferences(ts, file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const references = [];
  const add = (node, value, kind) => {
    if (value && ts.isStringLiteralLike(value)) references.push({
      line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
      module: value.text,
      kind,
    });
  };
  const visit = (node) => {
    if (ts.isStringLiteralLike(node) && /^https?:\/\//.test(node.text) && /openai|anthropic|elevenlabs|kie\.ai|freepik|huggingface|hf\.co|mediapipe|silero|\.(?:onnx|tflite)(?:$|\?)/i.test(node.text)) add(node, node, "provider-or-model-url");
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node, node.moduleSpecifier, "import/export");
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) add(node, node.argument.literal, "import-type");
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node, node.arguments[0], "dynamic-import");
      if (ts.isIdentifier(node.expression) && node.expression.text === "require") add(node, node.arguments[0], "require");
      if (ts.isPropertyAccessExpression(node.expression) && ["mock", "doMock"].includes(node.expression.name.text)) add(node, node.arguments[0], "mock");
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "URL") add(node, node.arguments?.[0], "url-reference");
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return references;
}

const targetPattern = /@openreel\/(?:agent(?:-runner)?|creation-agent|creation-schema)(?:\/|$)|@huggingface\/transformers|@mediapipe\/tasks-vision|onnxruntime|(?:^|\/)(?:agent|kieai|ai)\/|(?:^|\/)(?:api-proxy|ai-shader(?:-prompt)?|useElevenLabsApi|useTtsActions|multicam-transcription|multicam-face-reactions|whisper-worker|whisper-models|speech-to-text-engine|silero-vad)(?:\.[cm]?[jt]sx?)?$/;

export function collectInventory() {
  // Use the already-installed workspace compiler; this adds no dependency.
  const ts = createRequire(resolve(root, "apps/web/package.json"))("typescript");
  const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z", "--", "apps", "packages", "scripts", "tsconfig.base.json"], { cwd: root, encoding: "utf8" })
    .split("\0").filter(Boolean).sort();
  const sourceImports = [];
  const resourceDefinitions = [];
  const configurationReferences = [];
  let scannedSourceFiles = 0;
  for (const file of files) {
    if (/\.(?:[cm]?[jt]sx?)$/.test(file)) {
      scannedSourceFiles++;
      for (const reference of findModuleReferences(ts, file, readFileSync(resolve(root, file), "utf8"))) {
        if (reference.kind === "provider-or-model-url") {
          const url = new URL(reference.module);
          resourceDefinitions.push({ file, ...reference, module: url.origin + url.pathname });
        }
        else {
          const target = reference.module.startsWith(".") ? slash(relative(root, resolve(root, dirname(file), reference.module))) : reference.module;
          if (targetPattern.test(target)) sourceImports.push({ file, ...reference });
        }
      }
    }
    if (/(?:^|\/)(?:package\.json|tsconfig[^/]*\.json|vite\.config\.[cm]?[jt]s|vitest\.config\.[cm]?[jt]s)$/.test(file)) {
      readFileSync(resolve(root, file), "utf8").split(/\r?\n/).forEach((text, index) => {
        if (/@openreel\/(?:agent|creation-agent|creation-schema)|packages\/(?:agent|creation-agent|creation-schema)|@huggingface\/transformers|@mediapipe\/tasks-vision|onnxruntime/.test(text)) configurationReferences.push({ file, line: index + 1, text: text.trim() });
      });
    }
  }
  return {
    scope: "Git-visible JS/TS in apps, packages, scripts; static imports/exports, dynamic imports, import types, require, mocks and new URL references. Relative specifiers are normalized to include package-internal and transport test imports. Package/config aliases and known provider/model URL literals included. Computed module names and dependency internals are not resolved.",
    note: "Includes tests, desktop remnants, production functions and creation-schema review candidates. This is an inventory, not a deletion list or an AI-absence guard.",
    scannedSourceFiles,
    importingFiles: new Set(sourceImports.map((entry) => entry.file)).size,
    sourceImports,
    resourceDefinitions,
    configurationReferences,
  };
}

export function measureBundle(directory) {
  if (!existsSync(resolve(directory, "index.html"))) throw new Error("Build the web app first: dist/index.html is missing");
  const files = [];
  const walk = (path) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const absolute = resolve(path, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) files.push({ absolute, path: slash(relative(directory, absolute)) });
    }
  };
  walk(directory);
  const assets = files.filter((file) => /^(?:assets\/|index\.html$)/.test(file.path)).map((file) => {
    const bytes = readFileSync(file.absolute);
    return { path: file.path, bytes: bytes.length, gzipBytes: gzipSync(bytes, { level: 9 }).length, sha256: sha256(bytes) };
  }).sort((a, b) => a.path.localeCompare(b.path));
  return {
    scope: "All emitted assets/ files plus index.html; copied public files excluded from emitted totals. Includes lazy/worker assets, not initial-load transfer size. Gzip level 9 measured independently for each file.",
    totalDistFiles: files.length,
    totalDistBytes: files.reduce((sum, file) => sum + statSync(file.absolute).size, 0),
    emittedFiles: assets.length,
    emittedBytes: assets.reduce((sum, file) => sum + file.bytes, 0),
    emittedGzipBytes: assets.reduce((sum, file) => sum + file.gzipBytes, 0),
    byExtension: Object.fromEntries([...new Set(assets.map((file) => extname(file.path)))].sort().map((extension) => {
      const matches = assets.filter((file) => extname(file.path) === extension);
      return [extension, { files: matches.length, bytes: matches.reduce((sum, file) => sum + file.bytes, 0), gzipBytes: matches.reduce((sum, file) => sum + file.gzipBytes, 0) }];
    })),
    assets,
  };
}

function main() {
  const [command, input, output] = process.argv.slice(2);
  let report;
  if (command === "inventory") report = collectInventory();
  else if (command === "har" && input) {
    const bytes = readFileSync(input);
    report = { sourceBytes: bytes.length, sourceSha256: sha256(bytes), ...summarizeHar(JSON.parse(bytes.toString("utf8"))) };
  } else if (command === "bundle" && input) report = measureBundle(resolve(input));
  else throw new Error("Usage: node scripts/ai-removal-phase0.mjs inventory | har <input.har> [output.json] | bundle <dist> [output.json]. Inventory writes JSON to stdout.");
  const json = JSON.stringify(report, null, 2) + "\n";
  if (output) writeFileSync(output, json); else process.stdout.write(json);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
