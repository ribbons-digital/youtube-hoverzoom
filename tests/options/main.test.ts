import { describe, expect, it, vi } from "vitest";
import { renderOptionsPage } from "../../src/options/main";

describe("options page", () => {
  it("renders MVP toggles and saves edits", async () => {
    const saveSettings = vi.fn();
    document.body.innerHTML = `<div id="app"></div>`;

    await renderOptionsPage({
      settings: {
        enabled: true,
        hoverDelayMs: 250,
        closeDelayMs: 150,
        defaultMuted: true,
        defaultVolume: 35,
        overlayWidth: 480,
        overlayHeight: 270,
        showMetadata: true,
        enableOnHome: true,
        enableOnSearch: true,
        enableOnSubscriptions: true,
        enableOnWatchSidebar: true,
        enableOnChannelVideos: true,
        debug: false
      },
      saveSettings
    });

    expect(document.querySelector('input[name="hoverDelayMs"]')).not.toBeNull();
    expect(document.querySelector('input[name="enableOnChannelVideos"]')).not.toBeNull();
    expect(document.querySelector('input[name="showMetadata"]')).not.toBeNull();

    const volume = document.querySelector<HTMLInputElement>('input[name="defaultVolume"]') as HTMLInputElement;
    volume.value = "55";
    volume.dispatchEvent(new Event("change", { bubbles: true }));

    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ defaultVolume: 55 }));
  });
});
