import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/shared/settings";
import { getSettings, saveLiveAudioState, saveSettings } from "../../src/shared/storage";

describe("storage helpers", () => {
  beforeEach(() => {
    const store = new Map<string, unknown>();

    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => Object.fromEntries(store)),
          set: vi.fn(async (value: Record<string, unknown>) => {
            Object.entries(value).forEach(([key, entry]) => {
              store.set(key, entry);
            });
          })
        }
      }
    } as unknown as typeof chrome;
  });

  it("merges stored values over defaults", async () => {
    await saveSettings({ hoverDelayMs: 500, enableOnSearch: false });
    const settings = await getSettings();

    expect(settings.hoverDelayMs).toBe(500);
    expect(settings.enableOnSearch).toBe(false);
    expect(settings.defaultVolume).toBe(DEFAULT_SETTINGS.defaultVolume);
  });

  it("persists live mute and volume updates only", async () => {
    await saveLiveAudioState({ defaultMuted: false, defaultVolume: 75 });
    const settings = await getSettings();

    expect(settings.defaultMuted).toBe(false);
    expect(settings.defaultVolume).toBe(75);
  });
});
