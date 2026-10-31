import type { HoverPlayerSettings } from "../shared/settings";
import "./styles.css";

const SETTINGS_KEY = "settings";

const DEFAULT_SETTINGS: HoverPlayerSettings = {
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

type RenderOptionsArgs = {
  settings: HoverPlayerSettings;
  saveSettings: (next: Partial<HoverPlayerSettings>) => Promise<unknown> | unknown;
};

function clampSettings(settings: HoverPlayerSettings): HoverPlayerSettings {
  return {
    ...settings,
    hoverDelayMs: Math.max(400, settings.hoverDelayMs),
    closeDelayMs: Math.max(0, settings.closeDelayMs),
    defaultVolume: Math.max(0, Math.min(100, settings.defaultVolume)),
    overlayWidth: Math.max(320, Math.min(1280, settings.overlayWidth)),
    overlayHeight: Math.max(180, Math.min(720, settings.overlayHeight))
  };
}

async function getSettingsLocal(): Promise<HoverPlayerSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = (result[SETTINGS_KEY] ?? {}) as Partial<HoverPlayerSettings>;
  return clampSettings({ ...DEFAULT_SETTINGS, ...stored });
}

async function saveSettingsLocal(next: Partial<HoverPlayerSettings>): Promise<HoverPlayerSettings> {
  const merged = clampSettings({ ...(await getSettingsLocal()), ...next });
  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}

function toBooleanField(name: keyof HoverPlayerSettings, label: string, checked: boolean) {
  return `<label><span>${label}</span><input type="checkbox" name="${name}" ${checked ? "checked" : ""} /></label>`;
}

function toNumberField(
  name: keyof HoverPlayerSettings,
  label: string,
  value: number,
  min: number,
  max: number,
  step = 1
) {
  return `<label><span>${label}</span><input type="number" name="${name}" min="${min}" max="${max}" step="${step}" value="${value}" /></label>`;
}

export async function renderOptionsPage({ settings, saveSettings }: RenderOptionsArgs) {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("Missing #app container");

  app.innerHTML = `
    <div class="yhp-options-card">
      <h1>YouTube Hover Player</h1>
      <form id="options-form" class="yhp-options-grid">
        ${toBooleanField("enabled", "Extension enabled", settings.enabled)}
        ${toBooleanField("defaultMuted", "Start muted", settings.defaultMuted)}
        ${toBooleanField("showMetadata", "Show metadata", settings.showMetadata)}
        ${toBooleanField("debug", "Enable debug logs", settings.debug)}
        ${toBooleanField("enableOnHome", "Home", settings.enableOnHome)}
        ${toBooleanField("enableOnSearch", "Search", settings.enableOnSearch)}
        ${toBooleanField("enableOnSubscriptions", "Subscriptions", settings.enableOnSubscriptions)}
        ${toBooleanField("enableOnWatchSidebar", "Watch sidebar", settings.enableOnWatchSidebar)}
        ${toBooleanField("enableOnChannelVideos", "Channel videos", settings.enableOnChannelVideos)}
        ${toNumberField("hoverDelayMs", "Hover delay (ms)", settings.hoverDelayMs, 400, 2000)}
        ${toNumberField("closeDelayMs", "Close delay (ms)", settings.closeDelayMs, 0, 2000)}
        ${toNumberField("overlayWidth", "Overlay width", settings.overlayWidth, 320, 1280)}
        ${toNumberField("overlayHeight", "Overlay height", settings.overlayHeight, 180, 720)}
        <label>
          <span>Default volume</span>
          <input type="range" name="defaultVolume" min="0" max="100" value="${settings.defaultVolume}" />
        </label>
      </form>
      <p class="yhp-status" id="status"></p>
    </div>
  `;

  const form = app.querySelector<HTMLFormElement>("#options-form");
  const status = app.querySelector<HTMLElement>("#status");
  if (!form || !status) return;

  form.addEventListener("change", async (event) => {
    const target = event.target as HTMLInputElement;

    const next =
      target.type === "checkbox"
        ? { [target.name]: target.checked }
        : { [target.name]: Number(target.value) };

    await saveSettings(next as Partial<HoverPlayerSettings>);
    status.textContent = "Saved";
    window.setTimeout(() => {
      status.textContent = "";
    }, 900);
  });
}

if (typeof chrome !== "undefined" && chrome.storage?.local) {
  void getSettingsLocal().then((settings) => renderOptionsPage({ settings, saveSettings: saveSettingsLocal }));
}
