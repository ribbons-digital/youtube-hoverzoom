import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  clampSettings,
  getShortsWidth,
  isPageEnabled,
  normalizeSettings,
  type HoverPlayerSettings
} from "../../src/shared/settings";

describe("settings defaults", () => {
  it("ships with the approved MVP defaults", () => {
    expect(DEFAULT_SETTINGS.hoverDelayMs).toBe(400);
    expect(DEFAULT_SETTINGS.closeDelayMs).toBe(150);
    expect(DEFAULT_SETTINGS.enableOnChannelVideos).toBe(true);
    expect(DEFAULT_SETTINGS.overlayWidth).toBe(960);
    expect(DEFAULT_SETTINGS.overlayHeight).toBe(540);
    expect(DEFAULT_SETTINGS.enableShorts).toBe(true);
  });

  it("gives Shorts a 9:16 width from the preview height", () => {
    expect(getShortsWidth(540)).toBe(304);
    expect(getShortsWidth(720)).toBe(405);
    expect(getShortsWidth(180)).toBe(101);
  });

  it("turns Shorts previews on for settings saved before the Shorts setting existed", () => {
    expect(normalizeSettings({ ...DEFAULT_SETTINGS, enableShorts: undefined }).enableShorts).toBe(true);
  });

  it("clamps volume and overlay dimensions to sane bounds", () => {
    const clamped = clampSettings({
      ...DEFAULT_SETTINGS,
      hoverDelayMs: 0,
      defaultVolume: 999,
      overlayWidth: 200,
      overlayHeight: 900
    });

    expect(clamped.hoverDelayMs).toBe(400);
    expect(clamped.defaultVolume).toBe(100);
    expect(clamped.overlayWidth).toBe(320);
    expect(clamped.overlayHeight).toBe(720);
  });

  it("maps page-type flags correctly", () => {
    const disabledSearch: HoverPlayerSettings = {
      ...DEFAULT_SETTINGS,
      enableOnSearch: false
    };

    expect(isPageEnabled("home", disabledSearch)).toBe(true);
    expect(isPageEnabled("search", disabledSearch)).toBe(false);
  });

  it("caps delays and rounds numbers to whole values", () => {
    const clamped = clampSettings({ ...DEFAULT_SETTINGS, hoverDelayMs: 99999, closeDelayMs: 150.6 });

    expect(clamped.hoverDelayMs).toBe(2000);
    expect(clamped.closeDelayMs).toBe(151);
  });

  it("replaces stored values of the wrong type with defaults", () => {
    const settings = normalizeSettings({
      enabled: "yes",
      hoverDelayMs: null,
      overlayWidth: Number.NaN,
      defaultVolume: 80,
      unknownKey: true
    });

    expect(settings.enabled).toBe(DEFAULT_SETTINGS.enabled);
    expect(settings.hoverDelayMs).toBe(DEFAULT_SETTINGS.hoverDelayMs);
    expect(settings.overlayWidth).toBe(DEFAULT_SETTINGS.overlayWidth);
    expect(settings.defaultVolume).toBe(80);
    expect(settings).not.toHaveProperty("unknownKey");
  });

  it("returns defaults when nothing is stored", () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
  });
});
