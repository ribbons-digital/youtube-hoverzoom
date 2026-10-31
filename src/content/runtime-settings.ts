import type { SupportedPageType } from "../shared/page-types";
import type { HoverPlayerSettings } from "../shared/settings";

export const DEFAULT_CONTENT_SETTINGS: HoverPlayerSettings = {
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

export function clampContentSettings(settings: HoverPlayerSettings): HoverPlayerSettings {
  return {
    ...settings,
    hoverDelayMs: Math.max(400, settings.hoverDelayMs),
    closeDelayMs: Math.max(0, settings.closeDelayMs),
    defaultVolume: Math.max(0, Math.min(100, settings.defaultVolume)),
    overlayWidth: Math.max(320, Math.min(1280, settings.overlayWidth)),
    overlayHeight: Math.max(180, Math.min(720, settings.overlayHeight))
  };
}

export function isContentPageEnabled(pageType: SupportedPageType, settings: HoverPlayerSettings): boolean {
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
