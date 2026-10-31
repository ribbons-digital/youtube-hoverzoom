import { describe, expect, it, vi } from "vitest";
import { renderPopup } from "../../src/popup/main";
import { DEFAULT_SETTINGS } from "../../src/shared/settings";

describe("popup", () => {
  it("renders an enabled toggle and opens settings", async () => {
    const saveSettings = vi.fn();
    const openOptionsPage = vi.fn();
    document.body.innerHTML = `<div id="app"></div>`;

    await renderPopup({
      settings: DEFAULT_SETTINGS,
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

  it("restores the toggle and shows an error when saving fails", async () => {
    const saveSettings = vi.fn(async () => {
      throw new Error("quota");
    });
    document.body.innerHTML = `<div id="app"></div>`;

    await renderPopup({ settings: DEFAULT_SETTINGS, saveSettings, openOptionsPage: vi.fn() });

    const enabled = document.querySelector<HTMLInputElement>('input[name="enabled"]') as HTMLInputElement;
    enabled.checked = false;
    enabled.dispatchEvent(new Event("change", { bubbles: true }));

    await vi.waitFor(() => expect(document.querySelector("#status")?.textContent).toBe("Could not save. Try again."));
    expect(enabled.checked).toBe(true);
  });
});
