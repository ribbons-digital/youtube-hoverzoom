import { beforeEach, describe, expect, it } from "vitest";
import { createOverlay } from "../../src/content/overlay";

describe("overlay DOM", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("mounts one reusable shell with close control and metadata region", () => {
    const overlay = createOverlay();
    overlay.mount();
    overlay.show({
      title: "Demo title",
      channel: "Demo channel",
      width: 480,
      height: 270
    });
    overlay.setPosition(100, 200);

    expect(document.querySelectorAll("#yhp-overlay")).toHaveLength(1);
    expect(document.querySelector('[data-action="close"]')).not.toBeNull();
    expect(document.querySelector(".yhp-meta")?.textContent).toContain("Demo title");
    expect(document.querySelector<HTMLElement>(".yhp-player-host")?.style.height).toBe("270px");
    expect(document.querySelector<HTMLElement>("#yhp-overlay")?.style.left).toBe("100px");
  });

  it("hides the metadata row when there is no metadata", () => {
    const overlay = createOverlay();
    overlay.show({ width: 480, height: 270 });

    expect(document.querySelector<HTMLElement>(".yhp-meta")?.hidden).toBe(true);
  });

  it("fixes a pinned overlay to the viewport and restores page coordinates on unpin", () => {
    Object.assign(window, { scrollY: 500 });
    try {
      const overlay = createOverlay();
      overlay.show({ width: 480, height: 270 });
      overlay.setPosition(100, 700);
      const node = overlay.getElement();
      node.getBoundingClientRect = () => new DOMRect(100, 200, 480, 300);

      overlay.setPinned(true);
      expect(node.dataset.pinned).toBe("true");
      expect(node.style.top).toBe("200px");
      expect(document.querySelector('[data-action="pin-toggle"]')?.getAttribute("aria-pressed")).toBe("true");

      overlay.setPinned(false);
      expect(node.dataset.pinned).toBeUndefined();
      expect(node.style.top).toBe("700px");
    } finally {
      Object.assign(window, { scrollY: 0 });
    }
  });
});
