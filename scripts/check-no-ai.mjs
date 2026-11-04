import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const ignoredDirectories = new Set(["node_modules", "dist", "build", "build-wasm", "build-native", "out", "coverage", ".git", ".wrangler", ".vite"]);
const textExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".html", ".css", ".toml", ".yaml", ".yml", ".cpp", ".hpp", ".h", ".c", ".rs", ".sh", ".cmake"]);
// Data-only historical inputs, not runtime clients or entire fixture directories.
const historicalFixtures = new Set([
  "apps/web/src/test/fixtures/ai-removal-browser-state.json",
  "packages/core/src/test/fixtures/ai-removal/legacy-ai-project.json",
]);
const rules = [
  ["agent workspace", /@openreel\/(?:agent(?:-runner)?|creation-agent|creation-schema)\b|packages\/(?:agent(?:-runner)?|creation-agent|creation-schema)(?:\/|["'])/i],
  ["inference/provider package", /@(?:huggingface|xenova|mediapipe|tensorflow|anthropic-ai|ai-sdk)\/|\bonnxruntime(?:-web|-node|-common)?\b|["'](?:openai|@google\/generative-ai|@google\/genai|langchain|@langchain\/[\w-]+)["']/i],
  ["retired provider/model URL", /(?:https?:\/\/|["'])(?:api\.)?(?:openai\.com|anthropic\.com|elevenlabs\.io|kie\.ai|replicate\.com|fal\.ai|huggingface\.co|hf\.co|generativelanguage\.googleapis\.com)(?:[/:"']|\b)|(?:ai|cloud)\.openreel\.video|storage\.googleapis\.com\/mediapipe-models|cdn\.jsdelivr\.net\/npm\/@(?:mediapipe|huggingface)/i],
  ["chat/provider/credential client", /\b(?:useChatStore|ChatPanel|AISettingsPanel|ApiKeysPanel|SERVICE_REGISTRY|configuredServices|defaultLlmProvider|agentAutoConfirm|agentDryRun|mcpAutoAllowTrustedLocal|installMCPListener|useKieAIPoller|KieAITask|TextToSpeechPanel|useElevenLabsApi|useTtsActions|GenerateShaderBox|generateAiShader|buildShaderAuthoringPrompt|onSessionLock)\b|llm-transport|api-proxy|secure-storage|tts-store|kieai-task|\/api\/proxy\//i],
  ["recognition/segmentation client", /\b(?:SpeechRecognition|webkitSpeechRecognition|SpeechToTextEngine|BackgroundRemovalEngine|BackgroundRemovalSection|BehindSubjectSection|PersonSegmentationEngine|AutoCaptionPanel|AiTab|isAIAvailable|isAIRequest|AI_OFFLINE|behindSubject)\b|whisper-(?:worker|models|audio)|speech-to-text-engine|person-segmentation|temporal-person-mask|background-removal|text-behind-subject|selfie_segmenter|face_landmarker|vision_bundle/i],
  ["multicam", /multicam|silero(?:[-_/]|\b)|\.orma\b|\botio\b/i],
  ["desktop IPC/build entry", /\b(?:DesktopApp|OPENREEL_DESKTOP|NativeFFmpegBackend|nativeMediaAvailable|probeAudioStreamCountViaNative|desktopPage|setDesktopPage|__openreelExportPath|__openreelExportPort)\b|(?:window|globalThis)\s*(?:\?\.|\.)\s*openreel\b|native-(?:aurora|media)-bridge|native-aurora-preview-session|openreel:menu:|\bopenreel\??\s*:\s*\{/i],
];
const retiredPaths = [
  "packages/agent", "packages/agent-runner", "packages/creation-agent", "packages/creation-schema", "packages/core/src/ai", "packages/core/src/multicam",
  "apps/desktop", "apps/web/src/desktop", "apps/web/functions/api/proxy", "apps/web/src/services/agent",
  "apps/web/src/components/editor/chat", "apps/web/src/components/welcome", "apps/web/src/components/tour",
  "apps/web/src/components/editor/AIGenTab.tsx", "apps/web/src/components/editor/ScreenRecorderDialog.tsx",
  "apps/web/src/workers/whisper-worker.ts", "apps/web/src/workers/whisper-models.ts", "apps/web/src/utils/whisper-audio.ts",
  "apps/web/src/services/api-proxy.ts", "apps/web/src/services/secure-storage.ts", "apps/web/src/services/ai-shader.ts",
  "apps/web/src/services/native-ffmpeg-backend.ts", "apps/web/src/motion/native-aurora-preview-session.ts",
  "packages/core/src/text/speech-to-text-engine.ts", "packages/core/src/media/native-media-bridge.ts",
  "packages/core/src/motion/native-aurora-bridge.ts", "packages/core/src/device/native-profile.ts",
];
function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name) || /\.config\.[cm]?[jt]s\.timestamp-\d+-[a-f0-9]+\.mjs$/.test(entry.name)) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : entry.isFile() ? [path] : [];
  });
}
const normalized = (root, path) => relative(root, path).replaceAll("\\", "/");

export function checkNoAI(root = projectRoot) {
  const files = [...new Set([
    ...["apps", "packages"].flatMap((path) => walk(resolve(root, path))),
    ...["package.json", "tsconfig.base.json", "bun.lock"].map((path) => resolve(root, path)).filter(existsSync),
  ])];
  const failures = [];
  let scanned = 0;
  for (const file of files) {
    const path = normalized(root, file);
    if (historicalFixtures.has(path) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) continue;
    if (/\.(?:onnx|tflite|ort)$/i.test(path)) failures.push(`${path}: inference model asset`);
    if (!(textExtensions.has(extname(file)) || /(?:^|\/)(?:bun\.lock|\.env(?:\.[^/]+)?|_headers|_redirects|CMakeLists\.txt)$/.test(path))) continue;
    scanned++;
    const contents = readFileSync(file, "utf8");
    for (const [label, pattern] of rules) if (pattern.test(contents)) failures.push(`${path}: ${label}`);
    // A fixture exception must not become a loophole for an executable import.
    if (/\.[cm]?[jt]sx?$/.test(path) && /(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)["'][^"']*(?:ai-removal-browser-state|legacy-ai-project)\.json/.test(contents)) {
      failures.push(`${path}: runtime imports historical removal fixture`);
    }
    if (/\.[cm]?[jt]sx?$/.test(path) && /(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)["'][^"']*\.(?:test|spec)(?:\.[cm]?[jt]sx?)?["']/.test(contents)) {
      failures.push(`${path}: runtime imports non-runtime test module`);
    }
  }
  for (const path of retiredPaths) {
    const absolute = resolve(root, path);
    if (existsSync(absolute) && (!statSync(absolute).isDirectory() || walk(absolute).length)) {
      failures.push(`${path}: retired entry point exists`);
    }
  }
  return { failures, scanned };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { failures, scanned } = checkNoAI();
  if (failures.length) {
    console.error(`No-AI/desktop check failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
    process.exitCode = 1;
  } else console.log(`No-AI/desktop check passed (${scanned} runtime/configuration files scanned).`);
}
