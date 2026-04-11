import { DEFAULT_SETTINGS, clampSettings, type HoverPlayerSettings } from "./settings";

const SETTINGS_KEY = "settings";

function hasStorage() {
  return typeof chrome !== "undefined" && !!chrome.storage?.local;
}

export async function getSettings(): Promise<HoverPlayerSettings> {
  if (!hasStorage()) return DEFAULT_SETTINGS;

  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = (result[SETTINGS_KEY] ?? {}) as Partial<HoverPlayerSettings>;
  return clampSettings({ ...DEFAULT_SETTINGS, ...stored });
}

export async function saveSettings(next: Partial<HoverPlayerSettings>): Promise<HoverPlayerSettings> {
  const merged = clampSettings({ ...(await getSettings()), ...next });
  if (hasStorage()) {
    await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  }
  return merged;
}

export async function saveLiveAudioState(
  next: Pick<HoverPlayerSettings, "defaultMuted" | "defaultVolume">
): Promise<HoverPlayerSettings> {
  return saveSettings(next);
}
