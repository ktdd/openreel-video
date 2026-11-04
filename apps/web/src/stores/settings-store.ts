import { create } from "zustand";
import { subscribeWithSelector, persist } from "zustand/middleware";

export interface SettingsState {
  autoSave: boolean;
  autoSaveInterval: number;
  language: string;
  settingsOpen: boolean;
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveInterval: (minutes: number) => void;
  setLanguage: (language: string) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        autoSave: true,
        autoSaveInterval: 5,
        language: "en",
        settingsOpen: false,
        setAutoSave: (autoSave) => set({ autoSave }),
        setAutoSaveInterval: (minutes) =>
          set({ autoSaveInterval: Math.max(1, Math.min(30, minutes)) }),
        setLanguage: (language) => set({ language }),
        openSettings: () => set({ settingsOpen: true }),
        closeSettings: () => set({ settingsOpen: false }),
      }),
      {
        name: "openreel-settings",
        partialize: (state) => ({
          autoSave: state.autoSave,
          autoSaveInterval: state.autoSaveInterval,
          language: state.language,
        }),
      },
    ),
  ),
);
