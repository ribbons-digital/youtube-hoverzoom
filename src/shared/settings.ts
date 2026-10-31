import type { SupportedPageType } from "./page-types";

export type HoverPlayerSettings = {
  enabled: boolean;
  hoverDelayMs: number;
  closeDelayMs: number;
  defaultMuted: boolean;
  defaultVolume: number;
  overlayWidth: number;
  overlayHeight: number;
  showMetadata: boolean;
  enableOnHome: boolean;
  enableOnSearch: boolean;
  enableOnSubscriptions: boolean;
  enableOnWatchSidebar: boolean;
  enableOnChannelVideos: boolean;
  debug: boolean;
};

type NumericSettingKey = {
  [K in keyof HoverPlayerSettings]: HoverPlayerSettings[K] extends number ? K : never;
}[keyof HoverPlayerSettings];

export const DEFAULT_SETTINGS: HoverPlayerSettings = {
  enabled: true,
  hoverDelayMs: 400,
  closeDelayMs: 150,
  defaultMuted: true,
  defaultVolume: 35,
  overlayWidth: 960,
  overlayHeight: 540,
  showMetadata: true,
  enableOnHome: true,
  enableOnSearch: true,
  enableOnSubscriptions: true,
  enableOnWatchSidebar: true,
  enableOnChannelVideos: true,
  debug: false
};

export const NUMBER_LIMITS: Record<NumericSettingKey, { min: number; max: number }> = {
  hoverDelayMs: { min: 400, max: 2000 },
  closeDelayMs: { min: 0, max: 2000 },
  defaultVolume: { min: 0, max: 100 },
  overlayWidth: { min: 320, max: 1280 },
  overlayHeight: { min: 180, max: 720 }
};

export function isNumericSetting(key: keyof HoverPlayerSettings): key is NumericSettingKey {
  return key in NUMBER_LIMITS;
}

export function clampSettings(settings: HoverPlayerSettings): HoverPlayerSettings {
  const next = { ...settings };
  for (const key of Object.keys(NUMBER_LIMITS) as NumericSettingKey[]) {
    const { min, max } = NUMBER_LIMITS[key];
    const value = Number.isFinite(next[key]) ? Math.round(next[key]) : DEFAULT_SETTINGS[key];
    next[key] = Math.max(min, Math.min(max, value));
  }
  return next;
}

// Stored data is untrusted: drop unknown keys and values of the wrong type
// so a bad write can never break the content script or the options page.
export function normalizeSettings(stored: unknown): HoverPlayerSettings {
  const next = { ...DEFAULT_SETTINGS };
  if (stored && typeof stored === "object") {
    const source = stored as Record<string, unknown>;
    for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof HoverPlayerSettings>) {
      if (typeof source[key] === typeof DEFAULT_SETTINGS[key]) {
        (next as Record<string, unknown>)[key] = source[key];
      }
    }
  }
  return clampSettings(next);
}

export function isPageEnabled(pageType: SupportedPageType, settings: HoverPlayerSettings): boolean {
  if (!settings.enabled) return false;

  switch (pageType) {
    case "home":
      return settings.enableOnHome;
    case "search":
      return settings.enableOnSearch;
    case "subscriptions":
      return settings.enableOnSubscriptions;
    case "watchSidebar":
      return settings.enableOnWatchSidebar;
    case "channelVideos":
      return settings.enableOnChannelVideos;
    default:
      return false;
  }
}
