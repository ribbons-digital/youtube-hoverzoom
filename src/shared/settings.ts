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

export const DEFAULT_SETTINGS: HoverPlayerSettings = {
  enabled: true,
  hoverDelayMs: 400,
  closeDelayMs: 150,
  defaultMuted: true,
  defaultVolume: 35,
  overlayWidth: 960,
  overlayHeight: 720,
  showMetadata: true,
  enableOnHome: true,
  enableOnSearch: true,
  enableOnSubscriptions: true,
  enableOnWatchSidebar: true,
  enableOnChannelVideos: true,
  debug: false
};

export function clampSettings(settings: HoverPlayerSettings): HoverPlayerSettings {
  return {
    ...settings,
    hoverDelayMs: Math.max(400, settings.hoverDelayMs),
    closeDelayMs: Math.max(0, settings.closeDelayMs),
    defaultVolume: Math.max(0, Math.min(100, settings.defaultVolume)),
    overlayWidth: Math.max(320, Math.min(1280, settings.overlayWidth)),
    overlayHeight: Math.max(180, Math.min(720, settings.overlayHeight))
  };
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
