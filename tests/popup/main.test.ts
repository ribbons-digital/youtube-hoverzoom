import { describe, expect, it, vi } from "vitest";
import { renderPopup } from "../../src/popup/main";

describe("popup", () => {
  it("renders an enabled toggle and opens settings", async () => {
    const saveSettings = vi.fn();
    const openOptionsPage = vi.fn();
    document.body.innerHTML = `<div id="app"></div>`;

    await renderPopup({
      settings: {
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
      },
      saveSettings,
      openOptionsPage
    });

    const enabled = document.querySelector<HTMLInputElement>('input[name="enabled"]') as HTMLInputElement;
    enabled.checked = false;
    enabled.dispatchEvent(new Event("change", { bubbles: true }));

    const button = document.querySelector<HTMLButtonElement>('button[data-action="open-settings"]') as HTMLButtonElement;
    button.click();

    expect(saveSettings).toHaveBeenCalledWith({ enabled: false });
    expect(openOptionsPage).toHaveBeenCalledTimes(1);
  });
});
