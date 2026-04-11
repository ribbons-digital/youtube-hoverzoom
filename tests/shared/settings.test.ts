import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, clampSettings, isPageEnabled, type HoverPlayerSettings } from "../../src/shared/settings";

describe("settings defaults", () => {
  it("ships with the approved MVP defaults", () => {
    expect(DEFAULT_SETTINGS.hoverDelayMs).toBe(400);
    expect(DEFAULT_SETTINGS.closeDelayMs).toBe(150);
    expect(DEFAULT_SETTINGS.enableOnChannelVideos).toBe(true);
    expect(DEFAULT_SETTINGS.overlayWidth).toBe(960);
    expect(DEFAULT_SETTINGS.overlayHeight).toBe(720);
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
});
