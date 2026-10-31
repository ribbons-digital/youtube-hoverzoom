import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderOptionsPage } from "../../src/options/main";
import { DEFAULT_SETTINGS, normalizeSettings, type HoverPlayerSettings } from "../../src/shared/settings";

describe("options page", () => {
  let saveSettings: ReturnType<typeof vi.fn<(next: Partial<HoverPlayerSettings>) => Promise<HoverPlayerSettings>>>;
  let resetSettings: ReturnType<typeof vi.fn<() => Promise<HoverPlayerSettings>>>;

  const input = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`) as HTMLInputElement;
  const status = () => document.querySelector("#status")?.textContent ?? "";

  const change = async (element: HTMLInputElement, value: string) => {
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => undefined);
  };

  beforeEach(async () => {
    saveSettings = vi.fn(async (next) => normalizeSettings({ ...DEFAULT_SETTINGS, ...next }));
    resetSettings = vi.fn(async () => DEFAULT_SETTINGS);
    document.body.innerHTML = `<div id="app"></div>`;
    await renderOptionsPage({ settings: { ...DEFAULT_SETTINGS, overlayWidth: 480 }, saveSettings, resetSettings });
  });

  it("shows the stored values grouped with units", () => {
    expect(input("overlayWidth").value).toBe("480");
    expect(input("enableOnChannelVideos").checked).toBe(true);
    expect(document.querySelectorAll("fieldset legend")).not.toHaveLength(0);
    expect(document.body.textContent).toContain("400 to 2000 ms");
    expect(input("enableShorts").checked).toBe(true);
  });

  it("saves the Shorts switch", async () => {
    const shorts = input("enableShorts");
    shorts.checked = false;
    shorts.dispatchEvent(new Event("change", { bubbles: true }));
    await vi.waitFor(() => expect(status()).toBe("Saved"));

    expect(saveSettings).toHaveBeenCalledWith({ enableShorts: false });
    expect(shorts.checked).toBe(false);
  });

  it("saves a valid change and confirms it", async () => {
    await change(input("defaultVolume"), "55");

    expect(saveSettings).toHaveBeenCalledWith({ defaultVolume: 55 });
    await vi.waitFor(() => expect(status()).toBe("Saved"));
  });

  it("rejects an invalid number with a message and does not save it", async () => {
    await change(input("hoverDelayMs"), "50");

    expect(saveSettings).not.toHaveBeenCalled();
    expect(input("hoverDelayMs").getAttribute("aria-invalid")).toBe("true");
    expect(document.querySelector("#hoverDelayMs-error")?.textContent).toBe("Enter a whole number from 400 to 2000.");
    expect(input("hoverDelayMs").value).toBe("50");
  });

  it("rejects an empty number", async () => {
    await change(input("overlayHeight"), "");

    expect(saveSettings).not.toHaveBeenCalled();
    expect(document.querySelector<HTMLElement>("#overlayHeight-error")?.hidden).toBe(false);
  });

  it("keeps the entered value and shows a lasting error when saving fails", async () => {
    saveSettings.mockRejectedValueOnce(new Error("quota"));

    await change(input("closeDelayMs"), "300");

    await vi.waitFor(() => expect(status()).toContain("Could not save"));
    expect(input("closeDelayMs").value).toBe("300");
  });

  it("resets every field to its default", async () => {
    document.querySelector<HTMLButtonElement>('button[data-action="reset"]')?.click();

    await vi.waitFor(() => expect(input("overlayWidth").value).toBe(String(DEFAULT_SETTINGS.overlayWidth)));
    expect(resetSettings).toHaveBeenCalledTimes(1);
  });
});
