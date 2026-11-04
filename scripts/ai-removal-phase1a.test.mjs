import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
function sources(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "test" ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [path] : [];
  });
}

test("retired product implementations are removed, not merely hidden", () => {
  for (const path of [
    "apps/web/src/components/welcome",
    "apps/web/src/components/editor/tour",
    "apps/web/src/components/editor/ScreenRecorder.tsx",
    "apps/web/src/components/editor/RecordingControls.tsx",
    "apps/web/src/components/editor/RecordingCountdown.tsx",
    "apps/web/src/components/editor/SaveTemplateDialog.tsx",
    "apps/web/src/components/editor/inspector/TemplatesBrowserPanel.tsx",
    "apps/web/src/components/editor/inspector/TemplateVariablesPanel.tsx",
    "apps/web/src/components/editor/panels/TemplatesTab.tsx",
    "apps/web/src/services/template-cloud-service.ts",
    "apps/web/src/services/screen-recorder.ts",
    "apps/web/src/stores/recorder-store.ts",
    "apps/web/src/motion/components/MotionTemplateBrowser.tsx",
    "packages/core/src/template",
    "packages/core/src/motion/motion-presets.ts",
  ]) assert.equal(existsSync(resolve(root, path)), false, path);
});

test("startup and remaining runtimes cannot initialize retired product features", () => {
  // Exact feature identifiers, not blanket template/preset/recording bans:
  // Recipes, manual variables, layer animation, voice-over and export remain.
  const forbidden = /\b(?:WelcomeScreen|skipWelcomeScreen|setSkipWelcomeScreen|TemplateEngine|DEFAULT_TEMPLATES|MotionTemplateBrowser|ScreenRecorder|useRecorderStore|SpotlightTour|MoGraphTour|useTour|useMoGraphTour|apply_motion_template|getDisplayMedia)\b|data-tour=|openreel-(?:onboarding-complete|mograph-tour-complete)|template-cloud-service/;
  for (const directory of ["apps/web/src", "apps/web/functions", "packages/core/src"]) {
    for (const path of sources(resolve(root, directory))) {
      assert.doesNotMatch(readFileSync(path, "utf8"), forbidden, relative(root, path));
    }
  }
});

test("retained content and editor-side project access have not been deleted", () => {
  for (const path of [
    "apps/web/src/components/editor/RecoveryDialog.tsx",
    "apps/web/src/components/editor/ProjectSwitcher.tsx",
    "apps/web/src/components/editor/ProjectPackageDialog.tsx",
    "apps/web/src/components/editor/panels/RecipesTab.tsx",
    "apps/web/src/services/export-presets.ts",
    "packages/core/src/editing-templates/registry.ts",
    "packages/core/src/motion/motion-variables.ts",
    "packages/core/src/motion/motion-template-types.ts",
    "packages/core/src/types/project-presets.ts",
  ]) assert.equal(existsSync(resolve(root, path)), true, path);
});
