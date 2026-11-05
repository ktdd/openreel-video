import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loadStore = async () => (await import("./theme-store")).useThemeStore;

beforeEach(() => {
  vi.resetModules();
  localStorage.removeItem("openreel-theme");
  document.documentElement.classList.remove("dark");
  delete document.documentElement.dataset.theme;
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem("openreel-theme");
  document.documentElement.classList.remove("dark");
  delete document.documentElement.dataset.theme;
});

describe("explicit browser theme preferences", () => {
  it.each([false, true])("defaults to dark regardless of the system's dark preference (%s)", async (matches) => {
    const matchMedia = vi.spyOn(window, "matchMedia");
    matchMedia.mockReturnValue({ ...window.matchMedia("(prefers-color-scheme: dark)"), matches });
    matchMedia.mockClear();

    const store = await loadStore();
    expect(store.getState()).toMatchObject({ mode: "dark", isDark: true });
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(matchMedia).not.toHaveBeenCalled();
  });

  it.each(["light", "dark"] as const)("preserves saved %s mode and derives the matching appearance", async (mode) => {
    localStorage.setItem("openreel-theme", JSON.stringify({ state: { mode, isDark: mode === "light" }, version: 0 }));
    const store = await loadStore();
    expect(store.getState()).toMatchObject({ mode, isDark: mode === "dark" });
    expect(document.documentElement.classList.contains("dark")).toBe(mode === "dark");
    expect(document.documentElement).toHaveAttribute("data-theme", mode);
  });

  it.each(["auto", "invalid"])("normalizes a saved unsupported mode (%s) to dark", async (mode) => {
    localStorage.setItem("openreel-theme", JSON.stringify({ state: { mode, isDark: false }, version: 0 }));
    const store = await loadStore();
    expect(store.getState()).toMatchObject({ mode: "dark", isDark: true });
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("toggles directly between dark and light and persists the explicit choice", async () => {
    const store = await loadStore();
    for (const mode of ["light", "dark", "light"] as const) {
      store.getState().toggleTheme();
      expect(store.getState()).toMatchObject({ mode, isDark: mode === "dark" });
      expect(document.documentElement.classList.contains("dark")).toBe(mode === "dark");
      expect(document.documentElement).toHaveAttribute("data-theme", mode);
      expect(JSON.parse(localStorage.getItem("openreel-theme")!).state).toEqual({ mode, isDark: mode === "dark" });
    }
  });

  it("applies and persists a directly selected mode without consulting system preferences", async () => {
    const store = await loadStore();
    const matchMedia = vi.spyOn(window, "matchMedia");
    store.getState().setMode("light");
    expect(store.getState()).toMatchObject({ mode: "light", isDark: false });
    expect(document.documentElement).not.toHaveClass("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(matchMedia).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("openreel-theme")!).state.mode).toBe("light");
  });
});
