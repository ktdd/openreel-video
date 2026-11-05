import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: "dark",
      isDark: true,

      setMode: (mode: ThemeMode) => {
        const isDark = mode === "dark";
        set({ mode, isDark });

        if (isDark) {
          document.documentElement.classList.add("dark");
          document.documentElement.dataset.theme = "dark";
        } else {
          document.documentElement.classList.remove("dark");
          document.documentElement.dataset.theme = "light";
        }
      },

      toggleTheme: () => {
        get().setMode(get().mode === "dark" ? "light" : "dark");
      },
    }),
    {
      name: "openreel-theme",
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.mode = state.mode === "light" ? "light" : "dark";
          const isDark = state.mode === "dark";
          state.isDark = isDark;
          if (isDark) {
            document.documentElement.classList.add("dark");
            document.documentElement.dataset.theme = "dark";
          } else {
            document.documentElement.classList.remove("dark");
            document.documentElement.dataset.theme = "light";
          }
        }
      },
    },
  ),
);
