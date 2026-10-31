import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPlayerController } from "../../src/content/player-controller";

describe("player controller", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="yhp-player-host"></div>`;
  });

  it("creates a watch-surface iframe on open", () => {
    const host = document.querySelector("#yhp-player-host") as HTMLElement;
    const player = createPlayerController(host);

    player.open({ videoId: "abc12345678", muted: true, volume: 35 });

    const frame = host.querySelector<HTMLIFrameElement>("iframe");
    expect(frame).not.toBeNull();
    expect(frame?.src).toContain("/watch?v=abc12345678");
    expect(frame?.src).toContain("autoplay=1");
  });

  it("reuses iframe and updates src when switching videos", () => {
    const host = document.querySelector("#yhp-player-host") as HTMLElement;
    const player = createPlayerController(host);

    player.open({ videoId: "abc12345678", muted: true, volume: 35 });
    const first = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;

    player.open({ videoId: "def12345678", muted: true, volume: 35 });
    const second = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;

    expect(second).toBe(first);
    expect(second.src).toContain("/watch?v=def12345678");
  });

  it("preserves the last hovered video session across pause and reopen", () => {
    const host = document.querySelector("#yhp-player-host") as HTMLElement;
    const player = createPlayerController(host);

    player.open({ videoId: "abc12345678", muted: true, volume: 35 });
    const frame = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;
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

    player.pause();
    player.open({ videoId: "abc12345678", muted: true, volume: 35 });

    expect(video.pause).toHaveBeenCalledTimes(1);
    expect(video.play).toHaveBeenCalledTimes(1);
    expect(frame.src).toContain("/watch?v=abc12345678");
  });

  const stubWatchDocument = (frame: HTMLIFrameElement) => {
    const doc = document.implementation.createHTMLDocument("watch");
    const dispatchEvent = vi.fn();
    Object.defineProperty(frame, "contentDocument", {
      value: doc,
      configurable: true
    });
    Object.defineProperty(frame, "contentWindow", {
      value: { dispatchEvent },
      configurable: true
    });
    return Object.assign(doc, { __dispatchEvent: dispatchEvent });
  };

  it("injects cleanup styles into the watch document on load", () => {
    const host = document.querySelector("#yhp-player-host") as HTMLElement;
    const player = createPlayerController(host);

    player.open({ videoId: "abc12345678", muted: true, volume: 35 });
    const frame = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;
    const doc = stubWatchDocument(frame);

    frame.dispatchEvent(new Event("load"));

    const style = doc.getElementById("yhp-watch-cleanup");
    expect(style).not.toBeNull();
    expect(style?.textContent).toContain("ytd-live-chat-frame");
    expect(style?.textContent).toContain("#masthead-container");

    frame.dispatchEvent(new Event("load"));
    expect(doc.querySelectorAll("#yhp-watch-cleanup")).toHaveLength(1);
  });

  it("collapses the live chat frame when present", () => {
    const host = document.querySelector("#yhp-player-host") as HTMLElement;
    const player = createPlayerController(host);

    player.open({ videoId: "abc12345678", muted: true, volume: 35 });
    const frame = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;
    const doc = stubWatchDocument(frame);
    const chat = doc.createElement("ytd-live-chat-frame");
    doc.body.append(chat);

    frame.dispatchEvent(new Event("load"));

    expect(chat.hasAttribute("collapsed")).toBe(true);
  });

  it("dispatches a resize into the frame once the movie player exists", () => {
    const host = document.querySelector("#yhp-player-host") as HTMLElement;
    const player = createPlayerController(host);

    player.open({ videoId: "abc12345678", muted: true, volume: 35 });
    const frame = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;
    const doc = stubWatchDocument(frame);

    frame.dispatchEvent(new Event("load"));
    expect(doc.__dispatchEvent).not.toHaveBeenCalled();

    const moviePlayer = doc.createElement("div");
    moviePlayer.id = "movie_player";
    doc.body.append(moviePlayer);

    frame.dispatchEvent(new Event("load"));
    expect(doc.__dispatchEvent).toHaveBeenCalledTimes(1);
    expect((doc.__dispatchEvent.mock.calls[0][0] as Event).type).toBe("resize");

    frame.dispatchEvent(new Event("load"));
    expect(doc.__dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("injects cleanup styles via polling before the load event fires", () => {
    vi.useFakeTimers();
    try {
      const host = document.querySelector("#yhp-player-host") as HTMLElement;
      const player = createPlayerController(host);

      player.open({ videoId: "abc12345678", muted: true, volume: 35 });
      const frame = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;
      const doc = stubWatchDocument(frame);
      expect(doc.getElementById("yhp-watch-cleanup")).toBeNull();

      vi.advanceTimersByTime(250);

      expect(doc.getElementById("yhp-watch-cleanup")).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops cleanup polling on reset", () => {
    vi.useFakeTimers();
    try {
      const host = document.querySelector("#yhp-player-host") as HTMLElement;
      const player = createPlayerController(host);

      player.open({ videoId: "abc12345678", muted: true, volume: 35 });
      const frame = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;
      const doc = stubWatchDocument(frame);
      player.reset();

      vi.advanceTimersByTime(1000);

      expect(doc.getElementById("yhp-watch-cleanup")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clears the preserved watch session on reset", () => {
    const host = document.querySelector("#yhp-player-host") as HTMLElement;
    const player = createPlayerController(host);

    player.open({ videoId: "abc12345678", muted: true, volume: 35 });
    const frame = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;
    player.reset();

    expect(frame.src).toBe("about:blank");
  });
});
