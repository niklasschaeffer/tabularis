import { createContext } from "react";

export type AppLanguage = "auto" | "en" | "it";

export interface Settings {
  queryLimit: number;
  language: AppLanguage;
}

export interface SettingsContextType {
  settings: Settings;
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

export const DEFAULT_SETTINGS: Settings = {
  queryLimit: 500,
  language: "auto",
};
