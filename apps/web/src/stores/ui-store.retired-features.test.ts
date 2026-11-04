import "../test/install-local-storage-mock";
import { afterEach, describe, expect, it } from "vitest";
import { useUIStore } from "./ui-store";

const initial = useUIStore.getState();
afterEach(() => {
  useUIStore.setState(initial, true);
  localStorage.clear();
});

describe("retired product UI preferences", () => {
  it.each([false, true])("drops obsolete fields while retaining supported preferences (%s)", async (skipWelcomeScreen) => {
    localStorage.setItem("openreel-custom-export-presets", "[]");
    localStorage.setItem("unrelated-record", "keep");
    localStorage.setItem("openreel-ui-preferences", JSON.stringify({ version: 3, state: {
      skipWelcomeScreen, showWelcomeScreen: true,
      inspectorActiveTab: "templates", activeModal: "recorder",
      showWaveforms: false, showThumbnails: false,
      unknownRetiredField: "must not merge",
    } }));
    await useUIStore.persist.rehydrate();
    const once = useUIStore.getState();
    expect(once.inspectorActiveTab).toBe("transform");
    expect(once.activeModal).toBeNull();
    expect(once.showWaveforms).toBe(false);
    expect(once.showThumbnails).toBe(false);
    for (const key of ["skipWelcomeScreen", "showWelcomeScreen", "unknownRetiredField"]) {
      expect(once).not.toHaveProperty(key);
    }
    await useUIStore.persist.rehydrate();
    expect(useUIStore.getState()).toEqual(once);
    const persisted = JSON.parse(localStorage.getItem("openreel-ui-preferences")!);
    expect(persisted.version).toBe(4);
    expect(persisted.state).not.toHaveProperty("skipWelcomeScreen");
    expect(localStorage.getItem("openreel-custom-export-presets")).toBe("[]");
    expect(localStorage.getItem("unrelated-record")).toBe("keep");
  });

  it("whitelists preferences even for current-version records", async () => {
    localStorage.setItem("openreel-ui-preferences", JSON.stringify({ version: 4, state: {
      skipWelcomeScreen: false, activeModal: "recorder", inspectorActiveTab: "template-variables",
    } }));
    await useUIStore.persist.rehydrate();
    expect(useUIStore.getState()).not.toHaveProperty("skipWelcomeScreen");
    expect(useUIStore.getState().activeModal).toBeNull();
    expect(useUIStore.getState().inspectorActiveTab).toBe("transform");
  });
});
