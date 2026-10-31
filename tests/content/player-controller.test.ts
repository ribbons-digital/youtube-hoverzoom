import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installPageBridge } from "../../src/content/page-bridge";
import { createPlayerController } from "../../src/content/player-controller";
import { addFakeYouTubePlayer } from "../helpers/fake-youtube-player";

describe("player controller", () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="yhp-overlay"><div id="yhp-player-host"></div></div>`;
  });

  it("creates a watch-surface iframe on open", () => {
    const host = document.querySelector("#yhp-player-host") as HTMLElement;
    const player = createPlayerController(host);

    player.open({ videoId: "abc12345678", muted: true, volume: 35 });

    const frame = host.querySelector<HTMLIFrameElement>("iframe");
    expect(frame).not.toBeNull();
    expect(frame?.src).toContain("/watch?v=abc12345678");
    expect(frame?.src).toContain("autoplay=1");
    expect(frame?.src).not.toContain("mute=");
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

  describe("audio", () => {
    let removeBridge: () => void;

    beforeEach(() => {
      vi.useFakeTimers();
      removeBridge = installPageBridge();
    });

    afterEach(() => {
      removeBridge();
      vi.useRealTimers();
    });

    const openWithPlayer = (initial = { volume: 100, muted: true }) => {
      const onAudioChange = vi.fn();
      const host = document.querySelector("#yhp-player-host") as HTMLElement;
      const player = createPlayerController(host, { onAudioChange });
      player.open({ videoId: "abc12345678", muted: false, volume: 60 });
      const frame = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;
      const doc = stubWatchDocument(frame);
      const youtube = addFakeYouTubePlayer(doc, initial);
      frame.dispatchEvent(new Event("load"));
      return { player, frame, onAudioChange, ...youtube };
    };

    it("applies the requested mute and volume through YouTube's player API", () => {
      const { state } = openWithPlayer();

      expect(state).toEqual({ volume: 60, muted: false });
    });

    it("waits for playback to start before applying audio", () => {
      const host = document.querySelector("#yhp-player-host") as HTMLElement;
      const player = createPlayerController(host);
      player.open({ videoId: "abc12345678", muted: false, volume: 60 });
      const frame = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;
      const { video, state, setPaused } = addFakeYouTubePlayer(stubWatchDocument(frame));
      setPaused(true);
      frame.dispatchEvent(new Event("load"));
      expect(state.volume).toBe(100);

      setPaused(false);
      video.dispatchEvent(new Event("playing"));

      expect(state).toEqual({ volume: 60, muted: false });
    });

    it("keeps the requested audio when YouTube changes it right after playback starts", () => {
      const { onAudioChange, state, viewerChanges } = openWithPlayer();

      viewerChanges({ volume: 100, muted: true });

      expect(state).toEqual({ volume: 60, muted: false });
      expect(onAudioChange).not.toHaveBeenCalled();
    });

    it("reports audio changes the viewer makes in the preview", () => {
      const { onAudioChange, viewerChanges } = openWithPlayer();
      vi.advanceTimersByTime(1001);

      viewerChanges({ volume: 80 });

      expect(onAudioChange).toHaveBeenCalledWith({ muted: false, volume: 80 });
    });

    it("keeps the viewer's audio when the same video resumes", () => {
      const { player, state, viewerChanges, video } = openWithPlayer();
      vi.advanceTimersByTime(1001);
      viewerChanges({ volume: 80 });

      player.pause();
      player.open({ videoId: "abc12345678", muted: true, volume: 35 });
      video.dispatchEvent(new Event("playing"));

      expect(state).toEqual({ volume: 80, muted: false });
    });

    it("stops cleanup polling once the watch page is prepared", () => {
      const host = document.querySelector("#yhp-player-host") as HTMLElement;
      const player = createPlayerController(host);

      player.open({ videoId: "abc12345678", muted: true, volume: 35 });
      const frame = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;
      const doc = stubWatchDocument(frame);
      addFakeYouTubePlayer(doc);
      vi.advanceTimersByTime(250);
      expect(doc.getElementById("yhp-watch-cleanup")).not.toBeNull();

      doc.getElementById("yhp-watch-cleanup")?.remove();
      vi.advanceTimersByTime(1000);

      expect(doc.getElementById("yhp-watch-cleanup")).toBeNull();
    });
  });

  it("calls onEscape when Escape is pressed inside the preview", () => {
    const onEscape = vi.fn();
    const host = document.querySelector("#yhp-player-host") as HTMLElement;
    const player = createPlayerController(host, { onEscape });

    player.open({ videoId: "abc12345678", muted: true, volume: 35 });
    const frame = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;
    const doc = stubWatchDocument(frame);
    frame.dispatchEvent(new Event("load"));

    doc.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

});
