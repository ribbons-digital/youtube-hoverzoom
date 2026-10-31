import type { HoverPlayerSettings } from "../shared/settings";
import { getSettings, saveSettings } from "../shared/storage";
import "./styles.css";

type RenderPopupArgs = {
  settings: HoverPlayerSettings;
  saveSettings: (next: Partial<HoverPlayerSettings>) => Promise<unknown> | unknown;
  openOptionsPage: () => Promise<unknown> | unknown;
};

export async function renderPopup({ settings, saveSettings, openOptionsPage }: RenderPopupArgs) {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("Missing #app container");

  app.innerHTML = `
    <div class="yhp-popup">
      <div class="yhp-popup-card">
        <h1>YouTube Hover Player</h1>
        <label class="yhp-popup-toggle">
          <span>Enabled on YouTube</span>
          <input type="checkbox" name="enabled" ${settings.enabled ? "checked" : ""} />
        </label>
        <div class="yhp-popup-actions">
          <button type="button" data-action="open-settings">Open settings</button>
        </div>
        <p class="yhp-popup-status" id="status" role="status" aria-live="polite"></p>
      </div>
    </div>
  `;

  const status = app.querySelector<HTMLElement>("#status");
  const enabled = app.querySelector<HTMLInputElement>('input[name="enabled"]');
  const button = app.querySelector<HTMLButtonElement>('button[data-action="open-settings"]');
  if (!status || !enabled || !button) return;

  enabled.addEventListener("change", async () => {
    try {
      await saveSettings({ enabled: enabled.checked });
      status.textContent = enabled.checked ? "Previews are on" : "Previews are off";
      delete status.dataset.kind;
    } catch {
      enabled.checked = !enabled.checked;
      status.textContent = "Could not save. Try again.";
      status.dataset.kind = "error";
    }
  });

  button.addEventListener("click", async () => {
    await openOptionsPage();
  });
}

if (typeof chrome !== "undefined" && chrome.storage?.local) {
  void getSettings().then((settings) =>
    renderPopup({
      settings,
      saveSettings,
      openOptionsPage: () => chrome.runtime.openOptionsPage()
    })
  );
}
