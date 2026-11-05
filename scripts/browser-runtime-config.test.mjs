import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFileSync(resolve(root, path), "utf8");
function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (["node_modules", "dist", "build", "test", "__tests__"].includes(entry.name)) return [];
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.[cm]?[jt]sx?$/.test(path) && !/\.(?:test|spec)\./.test(path) ? [path] : [];
  });
}

test("initial HTML uses dark styling before JavaScript hydration", () => {
  const html = read("apps/web/index.html");
  assert.match(html, /<html\b[^>]*\bclass=["'][^"']*\bdark\b/);
  assert.match(html, /<html\b[^>]*\bdata-theme=["']dark["']/);
});

test("app manifests and lockfile contain neither analytics nor Wrangler deployment dependencies", () => {
  for (const path of ["package.json", "apps/web/package.json"]) {
    const pkg = JSON.parse(read(path));
    for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
      for (const name of Object.keys(pkg[field] ?? {})) {
        assert.doesNotMatch(name, /^(?:posthog-js|@posthog\/.*|wrangler)$/, `${path}: ${field}`);
      }
    }
    assert.equal(pkg.scripts?.deploy, undefined, path);
    assert.equal(pkg.scripts?.["deploy:preview"], undefined, path);
    assert.doesNotMatch(JSON.stringify(pkg.scripts), /\bwrangler\b|pages deploy/, path);
  }
  assert.doesNotMatch(read("bun.lock"), /"(?:wrangler|posthog-js|@posthog\/[^"\n]+)"\s*:/);
  for (const name of ["wrangler.toml", "wrangler.json", "wrangler.jsonc"]) {
    assert.equal(existsSync(resolve(root, "apps/web", name)), false, name);
  }
});

test("runtime source and startup configuration have no PostHog client, events or settings", () => {
  const forbidden = /\bposthog(?:-js)?\b|VITE_PUBLIC_POSTHOG|\buseAnalytics\b|\bAnalyticsEvents\b/i;
  const paths = ["apps/web/src", "packages/core/src", "packages/ui/src"].flatMap((directory) => sourceFiles(resolve(root, directory)));
  assert.ok(paths.length > 500);
  for (const path of paths) assert.doesNotMatch(readFileSync(path, "utf8"), forbidden, relative(root, path));
  for (const path of ["apps/web/index.html", "apps/web/vite.config.ts", "apps/web/public/_headers", "apps/web/.env.example"]) {
    if (existsSync(resolve(root, path))) assert.doesNotMatch(read(path), forbidden, path);
  }
  assert.equal(existsSync(resolve(root, "apps/web/src/hooks/useAnalytics.ts")), false);
});

test("unused vendored font files are absent while both referenced 3D fonts remain", () => {
  const directory = resolve(root, "apps/web/public/fonts");
  assert.equal(readdirSync(directory).some((name) => /\.woff2$/i.test(name)), false);
  assert.equal(existsSync(resolve(directory, "google-fonts.css")), false);
  const renderer = read("apps/web/src/components/editor/preview/threejs-layer-renderer.ts");
  for (const name of ["helvetiker_regular.typeface.json", "helvetiker_bold.typeface.json"]) {
    const font = JSON.parse(readFileSync(resolve(directory, name), "utf8"));
    assert.ok(font.glyphs.A, `${name} remains usable font data`);
    assert.ok(renderer.includes(`/fonts/${name}`), name);
  }
  // Removing unused public files must not remove ordinary/custom font loading.
  assert.match(read("apps/web/index.html"), /fonts\.googleapis\.com/);
  assert.match(read("apps/web/src/services/project-fonts.ts"), /ensureProjectFonts/);
});

test("procedural music and sound library is deleted while ordinary audio tools remain", () => {
  for (const path of [
    "apps/web/src/components/editor/inspector/MusicLibraryPanel.tsx",
    "packages/core/src/audio/sound-library-engine.ts",
    "packages/core/src/audio/sound-generator.ts",
    "packages/core/src/types/sound-library.ts",
  ]) assert.equal(existsSync(resolve(root, path)), false, path);
  for (const path of [
    "apps/web/src/components/editor/AssetsPanel.tsx",
    "apps/web/src/components/editor/inspector/index.ts",
    "apps/web/src/stores/engine-store.ts",
    "packages/core/src/audio/index.ts",
    "packages/core/src/types/index.ts",
  ]) assert.doesNotMatch(read(path), /MusicLibraryPanel|SoundLibraryEngine|soundLibrary|sound-library|sound-generator/, path);
  assert.doesNotMatch(read("apps/web/src/components/editor/AssetsPanel.tsx"), /value:\s*"audio"/);
  for (const path of [
    "packages/core/src/audio/audio-engine.ts",
    "packages/core/src/audio/audio-effects-engine.ts",
    "packages/core/src/audio/beat-detection-engine.ts",
    "apps/web/src/components/editor/inspector/VoiceOverPanel.tsx",
    "apps/web/src/components/editor/inspector/tabs/AudioTab.tsx",
    "apps/web/src/components/editor/ExportAudioDialog.tsx",
  ]) assert.ok(existsSync(resolve(root, path)), path);
});

test("current guidance points to browser docs, not deleted design archives or phase reports", () => {
  for (const path of [
    "AGENTS.md", "llm.txt", "docs/editor-workflows.md", "docs/OFFLINE.md",
    "docs/remove-ai-features.md", "packages/creation-core/README.md", "scripts/filters/README.md",
  ]) {
    assert.doesNotMatch(read(path), /(?:docs\/)?superpowers\/|MOBILE-(?:OFFLINE|PARITY)\.md|ai-removal-phase/, path);
  }
  for (const path of ["AGENTS.md", "llm.txt", "docs/editor-workflows.md"]) assert.match(read(path), /OFFLINE\.md/, path);
});
