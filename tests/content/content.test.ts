import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapContentScript as bootstrap } from "../../src/content/content";
import { DEFAULT_SETTINGS, type HoverPlayerSettings } from "../../src/shared/settings";

type StorageListener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void;

describe("content script orchestration", () => {
  const testSettings = {
    ...DEFAULT_SETTINGS,
    debug: false
  };

  let destroyers: Array<() => void> = [];

  const bootstrapContentScript = (settings: HoverPlayerSettings) => {
    const runtime = bootstrap(settings);
    destroyers.push(runtime.destroy);
    return runtime;
  };

  const installChromeStub = () => {
    const listeners: StorageListener[] = [];
    let stored: Record<string, unknown> = {};
    const set = vi.fn(async (value: Record<string, unknown>) => {
      stored = { ...stored, ...value };
    });
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => stored),
          set
        },
        onChanged: {
          addListener: vi.fn((listener: StorageListener) => {
            listeners.push(listener);
          }),
          removeListener: vi.fn()
        }
      }
    } as unknown as typeof chrome;

    const emitSettings = (next: HoverPlayerSettings) => {
      listeners.forEach((listener) => listener({ settings: { oldValue: testSettings, newValue: next } }, "local"));
    };
    return { set, emitSettings };
  };

  const hoverCard = () => {
    document.querySelector("img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  };

  const isOverlayHidden = () => document.querySelector("#yhp-overlay")?.hasAttribute("hidden");

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <ytd-rich-item-renderer>
        <a id="thumbnail" href="/watch?v=abc12345678"><img /></a>
        <a id="video-title">Demo title</a>
      </ytd-rich-item-renderer>
    `;
  });

  afterEach(() => {
    destroyers.forEach((destroy) => destroy());
    destroyers = [];
    Reflect.deleteProperty(globalThis, "chrome");
    window.history.replaceState({}, "", "/");
    vi.useRealTimers();
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

  it("discards the preview when YouTube starts a navigation", () => {
    bootstrapContentScript(testSettings);

    hoverCard();
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    const frame = document.querySelector<HTMLIFrameElement>("#yhp-player-host iframe") as HTMLIFrameElement;

    // YouTube calls history.pushState in the page's own script context, which
    // the content script cannot patch, so only its navigation events count.
    window.history.pushState({}, "", "/results?search_query=test");
    expect(isOverlayHidden()).toBe(false);

    document.dispatchEvent(new Event("yt-navigate-start"));

    expect(isOverlayHidden()).toBe(true);
    expect(frame.src).toBe("about:blank");
  });

  it("updates the active page after YouTube finishes a navigation", () => {
    bootstrapContentScript(testSettings);
    expect(document.documentElement.hasAttribute("data-yhp-active")).toBe(true);

    window.history.pushState({}, "", "/feed/history");
    document.dispatchEvent(new Event("yt-navigate-finish"));

    expect(document.documentElement.hasAttribute("data-yhp-active")).toBe(false);
    hoverCard();
    vi.advanceTimersByTime(testSettings.hoverDelayMs);
    expect(isOverlayHidden()).toBe(true);
  });

  it("keeps a pinned preview open while the page scrolls", () => {
    bootstrapContentScript(testSettings);

    hoverCard();
    vi.advanceTimersByTime(testSettings.hoverDelayMs);
    document.querySelector<HTMLElement>('[data-action="pin-toggle"]')?.click();

    window.dispatchEvent(new Event("scroll"));

    expect(isOverlayHidden()).toBe(false);
    expect(document.querySelector<HTMLElement>("#yhp-overlay")?.dataset.pinned).toBe("true");
  });

  it("opens a card even after an earlier hover could not open", () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<ytd-rich-item-renderer id="second"><a href="/watch?v=def12345678"><img id="second-img" /></a></ytd-rich-item-renderer>`
    );
    bootstrapContentScript(testSettings);

    hoverCard();
    // YouTube re-renders the first card before the hover delay ends.
    document.querySelector("ytd-rich-item-renderer")?.remove();
    vi.advanceTimersByTime(testSettings.hoverDelayMs);
    expect(isOverlayHidden()).toBe(true);

    vi.advanceTimersByTime(400);
    document.querySelector("#second-img")?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    expect(isOverlayHidden()).toBe(false);
    expect(document.querySelector<HTMLIFrameElement>("#yhp-player-host iframe")?.src).toContain("def12345678");
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
    const { emitSettings } = installChromeStub();
    bootstrapContentScript(testSettings);

    hoverCard();
    vi.advanceTimersByTime(testSettings.hoverDelayMs);
    expect(isOverlayHidden()).toBe(false);

    emitSettings({ ...testSettings, enabled: false });
    expect(document.documentElement.hasAttribute("data-yhp-active")).toBe(false);

    hoverCard();
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    expect(isOverlayHidden()).toBe(true);
  });

  it("applies a new hover delay without a page reload", () => {
    const { emitSettings } = installChromeStub();
    bootstrapContentScript(testSettings);

    emitSettings({ ...testSettings, hoverDelayMs: 1000 });
    hoverCard();
    vi.advanceTimersByTime(testSettings.hoverDelayMs);
    expect(isOverlayHidden()).toBe(true);

    vi.advanceTimersByTime(1000 - testSettings.hoverDelayMs);
    expect(isOverlayHidden()).toBe(false);
  });

  it("saves mute and volume changes made inside the preview", async () => {
    const { set } = installChromeStub();
    bootstrapContentScript(testSettings);

    hoverCard();
    vi.advanceTimersByTime(testSettings.hoverDelayMs);

    const frame = document.querySelector<HTMLIFrameElement>("#yhp-player-host iframe") as HTMLIFrameElement;
    const doc = document.implementation.createHTMLDocument("watch");
    Object.defineProperty(frame, "contentDocument", { value: doc, configurable: true });
    Object.defineProperty(frame, "contentWindow", { value: { dispatchEvent: vi.fn() }, configurable: true });
    const video = Object.assign(doc.createElement("video"), { play: vi.fn(async () => undefined), pause: vi.fn() });
    doc.body.append(video);
    frame.dispatchEvent(new Event("load"));

    video.dispatchEvent(new Event("playing"));
    vi.advanceTimersByTime(1001);
    video.muted = false;
    video.volume = 0.8;
    video.dispatchEvent(new Event("volumechange"));

    await vi.waitFor(() => {
      expect(set).toHaveBeenCalledWith({
        settings: expect.objectContaining({ defaultMuted: false, defaultVolume: 80 })
      });
    });
  });
});
