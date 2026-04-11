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

  it("clears the preserved watch session on reset", () => {
    const host = document.querySelector("#yhp-player-host") as HTMLElement;
    const player = createPlayerController(host);

    player.open({ videoId: "abc12345678", muted: true, volume: 35 });
    const frame = host.querySelector<HTMLIFrameElement>("iframe") as HTMLIFrameElement;
    player.reset();

    expect(frame.src).toBe("about:blank");
  });
});
