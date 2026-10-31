import { DEFAULT_SETTINGS, normalizeSettings, type HoverPlayerSettings } from "./settings";

export const SETTINGS_KEY = "settings";

function hasStorage() {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}

export async function getSettings(): Promise<HoverPlayerSettings> {
  if (!hasStorage()) return DEFAULT_SETTINGS;

  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return normalizeSettings(result[SETTINGS_KEY]);
}

export async function saveSettings(next: Partial<HoverPlayerSettings>): Promise<HoverPlayerSettings> {
  const merged = normalizeSettings({ ...(await getSettings()), ...next });
  if (hasStorage()) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  }
  return merged;
}

export async function resetSettings(): Promise<HoverPlayerSettings> {
  if (hasStorage()) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: DEFAULT_SETTINGS });
  }
  return DEFAULT_SETTINGS;
}

export async function saveLiveAudioState(
  next: Pick<HoverPlayerSettings, "defaultMuted" | "defaultVolume">
): Promise<HoverPlayerSettings> {
  return saveSettings(next);
}
