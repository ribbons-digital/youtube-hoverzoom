import {
  isNumericSetting,
  NUMBER_LIMITS,
  normalizeSettings,
  type HoverPlayerSettings
} from "../shared/settings";
import { getSettings, resetSettings, saveSettings, SETTINGS_KEY } from "../shared/storage";
import "./styles.css";

type SettingKey = keyof HoverPlayerSettings;

type RenderOptionsArgs = {
  settings: HoverPlayerSettings;
  saveSettings: (next: Partial<HoverPlayerSettings>) => Promise<HoverPlayerSettings>;
  resetSettings: () => Promise<HoverPlayerSettings>;
};

const SAVED_MESSAGE_MS = 1500;

function toBooleanField(name: SettingKey, label: string, hint = "") {
  const hintId = `${name}-hint`;
  return `
    <div class="yhp-field">
      <label for="${name}">${label}</label>
      <input type="checkbox" id="${name}" name="${name}" ${hint ? `aria-describedby="${hintId}"` : ""} />
      ${hint ? `<p class="yhp-hint" id="${hintId}">${hint}</p>` : ""}
    </div>`;
}

function toNumberField(name: SettingKey, label: string, unit: string, note = "") {
  if (!isNumericSetting(name)) throw new Error(`${name} is not a number setting`);
  const { min, max } = NUMBER_LIMITS[name];
  return `
    <div class="yhp-field">
      <label for="${name}">${label}</label>
      <span class="yhp-number">
        <input type="number" id="${name}" name="${name}" min="${min}" max="${max}" step="1" required
          aria-describedby="${name}-hint ${name}-error" />
        <span class="yhp-unit">${unit}</span>
      </span>
      <p class="yhp-hint" id="${name}-hint">${min} to ${max} ${unit}.${note ? ` ${note}` : ""}</p>
      <p class="yhp-error" id="${name}-error" hidden></p>
    </div>`;
}

function toVolumeField() {
  const { min, max } = NUMBER_LIMITS.defaultVolume;
  return `
    <div class="yhp-field">
      <label for="defaultVolume">Volume</label>
      <span class="yhp-number">
        <input type="range" id="defaultVolume" name="defaultVolume" min="${min}" max="${max}" step="1"
          aria-describedby="defaultVolume-hint" />
        <output for="defaultVolume" id="defaultVolume-value"></output>
      </span>
      <p class="yhp-hint" id="defaultVolume-hint">Used when a preview starts with sound.</p>
    </div>`;
}

export async function renderOptionsPage({ settings, saveSettings, resetSettings }: RenderOptionsArgs) {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) throw new Error("Missing #app container");

  app.innerHTML = `
    <main class="yhp-options-card">
      <h1>YouTube Hover Player settings</h1>
      <p class="yhp-intro">Changes save automatically and apply to open YouTube tabs right away.</p>
      <form id="options-form" novalidate>
        <fieldset>
          <legend>General</legend>
          ${toBooleanField("enabled", "Show previews on YouTube")}
          ${toBooleanField("showMetadata", "Show title and channel under the preview")}
        </fieldset>
        <fieldset>
          <legend>Timing</legend>
          ${toNumberField("hoverDelayMs", "Wait before a preview opens", "ms")}
          ${toNumberField("closeDelayMs", "Wait before a preview closes", "ms")}
        </fieldset>
        <fieldset>
          <legend>Size</legend>
          ${toNumberField("overlayWidth", "Preview width", "px")}
          ${toNumberField(
            "overlayHeight",
            "Preview height",
            "px",
            "Shorts use this height with a tall width. 540 px tall gives 304 px wide."
          )}
        </fieldset>
        <fieldset>
          <legend>Audio</legend>
          <p class="yhp-hint">When you mute, unmute, or change the volume inside a preview, the next preview uses the same audio.</p>
          ${toBooleanField("defaultMuted", "Start previews muted")}
          ${toVolumeField()}
        </fieldset>
        <fieldset>
          <legend>Pages</legend>
          <p class="yhp-hint">Show previews on these YouTube pages.</p>
          ${toBooleanField("enableOnHome", "Home")}
          ${toBooleanField("enableOnSearch", "Search results")}
          ${toBooleanField("enableOnSubscriptions", "Subscriptions")}
          ${toBooleanField("enableOnWatchSidebar", "Watch page sidebar")}
          ${toBooleanField("enableOnChannelVideos", "Channel videos and Shorts")}
          ${toBooleanField("enableShorts", "Preview Shorts", "Show previews for Shorts cards on the pages above.")}
        </fieldset>
        <fieldset>
          <legend>Troubleshooting</legend>
          ${toBooleanField("debug", "Write debug messages", "Messages appear in the browser console on YouTube pages.")}
        </fieldset>
      </form>
      <section class="yhp-notes" aria-labelledby="notes-title">
        <h2 id="notes-title">Good to know</h2>
        <ul>
          <li>Previews use the full YouTube watch page. If you are signed in to YouTube, videos you preview can appear in your watch history and affect your recommendations.</li>
          <li>While previews are on, YouTube's own hover preview is hidden on the pages above.</li>
        </ul>
      </section>
      <div class="yhp-actions">
        <button type="button" data-action="reset">Reset to defaults</button>
        <p class="yhp-status" id="status" role="status" aria-live="polite"></p>
      </div>
    </main>
  `;

  const form = app.querySelector<HTMLFormElement>("#options-form");
  const status = app.querySelector<HTMLElement>("#status");
  const resetButton = app.querySelector<HTMLButtonElement>('button[data-action="reset"]');
  const volumeValue = app.querySelector<HTMLOutputElement>("#defaultVolume-value");
  if (!form || !status || !resetButton || !volumeValue) return;

  let savedTimer: number | undefined;

  const getInput = (name: string) => form.querySelector<HTMLInputElement>(`input[name="${name}"]`);

  const setFieldError = (input: HTMLInputElement, message: string) => {
    const error = form.querySelector<HTMLElement>(`#${input.name}-error`);
    input.setAttribute("aria-invalid", String(!!message));
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  };

  // Shows the stored values, which can differ from what was typed (for
  // example a rounded number), so the page never shows unsaved values.
  const showSettings = (next: HoverPlayerSettings, except?: HTMLInputElement) => {
    for (const [name, value] of Object.entries(next)) {
      const input = getInput(name);
      if (!input || input === except) continue;
      if (input.type === "checkbox") {
        input.checked = Boolean(value);
      } else {
        input.value = String(value);
        setFieldError(input, "");
      }
    }
    volumeValue.value = String(next.defaultVolume);
  };

  const showStatus = (message: string, kind: "saved" | "error") => {
    window.clearTimeout(savedTimer);
    status.textContent = message;
    status.dataset.kind = kind;
    if (kind === "saved") {
      savedTimer = window.setTimeout(() => {
        status.textContent = "";
      }, SAVED_MESSAGE_MS);
    }
  };

  const readValue = (input: HTMLInputElement): Partial<HoverPlayerSettings> | null => {
    const name = input.name as SettingKey;
    if (input.type === "checkbox") return { [name]: input.checked };
    if (!isNumericSetting(name)) return null;

    const { min, max } = NUMBER_LIMITS[name];
    const value = input.value.trim() === "" ? NaN : Number(input.value);
    if (!Number.isInteger(value) || value < min || value > max) {
      setFieldError(input, `Enter a whole number from ${min} to ${max}.`);
      return null;
    }

    setFieldError(input, "");
    return { [name]: value };
  };

  const save = async (action: () => Promise<HoverPlayerSettings>) => {
    try {
      const saved = await action();
      showSettings(saved);
      showStatus("Saved", "saved");
    } catch {
      // Keep what the user entered, so they can try again.
      showStatus("Could not save your change. It is still shown above. Change it again to retry.", "error");
    }
  };

  showSettings(settings);

  form.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.name === "defaultVolume") volumeValue.value = target.value;
  });

  form.addEventListener("change", async (event) => {
    const target = event.target as HTMLInputElement;
    const next = readValue(target);
    if (!next) return;
    await save(() => saveSettings(next));
  });

  resetButton.addEventListener("click", async () => {
    await save(resetSettings);
  });

  // Audio changes made inside a preview save from the YouTube tab; show them here too.
  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[SETTINGS_KEY]?.newValue) return;
      const focused = document.activeElement instanceof HTMLInputElement ? document.activeElement : undefined;
      showSettings(normalizeSettings(changes[SETTINGS_KEY].newValue), focused);
    });
  }
}

if (typeof chrome !== "undefined" && chrome.storage?.local) {
  void getSettings().then((settings) => renderOptionsPage({ settings, saveSettings, resetSettings }));
}
