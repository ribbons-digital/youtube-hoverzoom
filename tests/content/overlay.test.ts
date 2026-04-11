import { describe, expect, it } from "vitest";
import { createOverlay } from "../../src/content/overlay";

describe("overlay DOM", () => {
  it("mounts one reusable shell with close control and metadata region", () => {
    const overlay = createOverlay();
    overlay.mount();
    overlay.show({
      title: "Demo title",
      channel: "Demo channel",
      left: 100,
      top: 200,
      width: 480,
      height: 270
    });

    expect(document.querySelectorAll("#yhp-overlay")).toHaveLength(1);
    expect(document.querySelector('[data-action="close"]')).not.toBeNull();
    expect(document.querySelector('[data-action="toggle-play"]')).toBeNull();
    expect(document.querySelector('[data-action="toggle-mute"]')).toBeNull();
    expect(document.querySelector('[data-action="volume"]')).toBeNull();
    expect(document.querySelector(".yhp-meta")?.textContent).toContain("Demo title");
    expect(document.querySelector<HTMLElement>(".yhp-player-host")?.style.height).toBe("270px");
  });
});
