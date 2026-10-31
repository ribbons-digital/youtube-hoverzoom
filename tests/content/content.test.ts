import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapContentScript } from "../../src/content/content";
import { DEFAULT_SETTINGS } from "../../src/shared/settings";

describe("content script orchestration", () => {
  const testSettings = {
    ...DEFAULT_SETTINGS,
    debug: false
  };

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <ytd-rich-item-renderer>
        <a id="thumbnail" href="/watch?v=abc12345678"><img /></a>
        <a id="video-title">Demo title</a>
      </ytd-rich-item-renderer>
    `;
  });

  it("opens overlay after hover delay", () => {
    bootstrapContentScript(testSettings);

    document.querySelector("img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(false);
  });

  it("creates an iframe player when hover opens", () => {
    bootstrapContentScript(testSettings);

    document.querySelector("img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    const frame = document.querySelector<HTMLIFrameElement>("#yhp-player-host iframe");
    expect(frame).not.toBeNull();
    expect(frame?.src).toContain("/watch?v=abc12345678");
  });

  it("uses the configured overlay height for the player host", () => {
    bootstrapContentScript({
      ...testSettings,
      overlayHeight: 540
    });

    document.querySelector("img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    expect(document.querySelector<HTMLElement>(".yhp-player-host")?.style.height).toBe("540px");
  });

  it("does not open if the pointer leaves the browser window during hover delay", () => {
    bootstrapContentScript(testSettings);

    const image = document.querySelector("img") as HTMLElement;
    image.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    image.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: null }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(true);
  });

  it("does not open if the pointer leaves the tile during hover delay but stays on the page", () => {
    document.body.insertAdjacentHTML("beforeend", `<input id="search-box" />`);
    bootstrapContentScript(testSettings);

    const image = document.querySelector("img") as HTMLElement;
    const searchBox = document.querySelector("#search-box") as HTMLElement;

    image.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    image.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: searchBox }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(true);
    expect(document.querySelector("#yhp-player-host iframe")).toBeNull();
  });

  it("closes on escape when focus is not editable", () => {
    bootstrapContentScript(testSettings);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(true);
  });

  it("closes after pointer leaves both tile and overlay", () => {
    bootstrapContentScript(testSettings);

    document.querySelector("img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    document.body.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.closeDelayMs + 10);

    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(true);
  });

  it("resumes the last hovered video when the same tile is hovered again", () => {
    bootstrapContentScript(testSettings);

    const image = document.querySelector("img") as HTMLElement;
    image.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    const frame = document.querySelector<HTMLIFrameElement>("#yhp-player-host iframe") as HTMLIFrameElement;
    const video = {
      play: vi.fn(),
      pause: vi.fn()
    } as unknown as HTMLVideoElement;

    Object.defineProperty(frame, "contentDocument", {
      value: {
        querySelector: vi.fn(() => video)
      },
      configurable: true
    });

    document.body.dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.closeDelayMs + 10);
    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(true);

    image.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    expect(video.pause).toHaveBeenCalledTimes(1);
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(frame.src).toContain("/watch?v=abc12345678");
  });

  it("closes immediately when the pointer leaves the browser window", () => {
    bootstrapContentScript(testSettings);

    const image = document.querySelector("img") as HTMLElement;
    image.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);
    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(false);

    image.dispatchEvent(new PointerEvent("pointerout", { bubbles: true, relatedTarget: null }));

    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(true);
  });

  it("does not close on window blur while the pointer is still inside the current tile", () => {
    const card = document.querySelector("ytd-rich-item-renderer") as HTMLElement;
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 10, 300, 200));

    bootstrapContentScript(testSettings);

    document
      .querySelector("img")
      ?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: 40, clientY: 40 }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    document.body.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 40, clientY: 40 }));
    window.dispatchEvent(new Event("blur"));

    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(false);
  });

  it("does not close while pointer moves inside current tile bounds", () => {
    const card = document.querySelector("ytd-rich-item-renderer") as HTMLElement;
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue(new DOMRect(10, 10, 300, 200));

    bootstrapContentScript(testSettings);

    document.querySelector("img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    document.body.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, clientX: 40, clientY: 40 })
    );
    vi.advanceTimersByTime(testSettings.closeDelayMs + 10);

    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(false);
  });

  it("does not close on window blur while the pointer is still inside the popup", () => {
    bootstrapContentScript(testSettings);

    document
      .querySelector("img")
      ?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: 40, clientY: 40 }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    const overlay = document.querySelector("#yhp-overlay") as HTMLElement;
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 100, 960, 800));

    document.body.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 140, clientY: 140 }));
    window.dispatchEvent(new Event("blur"));

    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(false);
  });

  it("does not close when popup pointerleave has no relatedTarget but the pointer is still inside the popup", () => {
    bootstrapContentScript(testSettings);

    document.querySelector("img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    const overlay = document.querySelector("#yhp-overlay") as HTMLElement;
    vi.spyOn(overlay, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 100, 960, 800));

    overlay.dispatchEvent(new PointerEvent("pointerenter"));
    overlay.dispatchEvent(new PointerEvent("pointerleave", { clientX: 140, clientY: 140 }));
    vi.advanceTimersByTime(testSettings.closeDelayMs + 10);

    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(false);
  });

  it("resets cleanly on route changes", () => {
    bootstrapContentScript(testSettings);

    document.querySelector("img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    const frame = document.querySelector<HTMLIFrameElement>("#yhp-player-host iframe") as HTMLIFrameElement;

    window.history.pushState({}, "", "/results?search_query=test");

    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(true);
    expect(frame.src).toBe("about:blank");
  });

  it("closes immediately when the page scrolls", () => {
    bootstrapContentScript(testSettings);

    document.querySelector("img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);
    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(false);

    window.dispatchEvent(new Event("scroll"));

    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(true);
  });

  it("blocks hover reopen until 200ms after scrolling stops", () => {
    bootstrapContentScript(testSettings);

    window.dispatchEvent(new Event("scroll"));

    document.querySelector("img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs + 50);
    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(true);

    vi.advanceTimersByTime(200);
    document.querySelector("img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(false);
  });

  it("responds to live enabled changes from extension storage", () => {
    const listeners: Array<(changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void> = [];
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({})),
          set: vi.fn(async () => undefined)
        },
        onChanged: {
          addListener: vi.fn((listener) => {
            listeners.push(listener);
          }),
          removeListener: vi.fn()
        }
      }
    } as unknown as typeof chrome;

    bootstrapContentScript(testSettings);

    document.querySelector("img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);
    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(false);

    listeners[0]?.(
      {
        settings: {
          oldValue: testSettings,
          newValue: { ...testSettings, enabled: false }
        }
      },
      "local"
    );

    document.querySelector("img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    expect(document.querySelector("#yhp-overlay")?.hasAttribute("hidden")).toBe(true);
  });
});
