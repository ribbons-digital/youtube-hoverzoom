import type { HoverPlayerSettings } from "../shared/settings";
import { clampContentSettings, DEFAULT_CONTENT_SETTINGS } from "./runtime-settings";

const SETTINGS_KEY = "settings";

export async function getContentSettings(): Promise<HoverPlayerSettings> {
  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return DEFAULT_CONTENT_SETTINGS;
  }

  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = (result[SETTINGS_KEY] ?? {}) as Partial<HoverPlayerSettings>;
  return clampContentSettings({ ...DEFAULT_CONTENT_SETTINGS, ...stored });
}
