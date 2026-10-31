import { describe, expect, it } from "vitest";
import { computeOverlayPosition } from "../../src/content/positioning";

const base = {
  overlayWidth: 480,
  overlayHeight: 270,
  viewportWidth: 1280,
  viewportHeight: 800,
  scrollX: 0,
  scrollY: 0,
  gap: 16
};

describe("overlay positioning", () => {
  it("prefers the right side when there is room", () => {
    const result = computeOverlayPosition({
      ...base,
      sourceRect: { top: 20, left: 20, right: 220, bottom: 132, width: 200, height: 112 }
    });

    expect(result.placement).toBe("right");
    expect(result.left).toBe(236);
  });

  it("slides a side placement up to stay inside the viewport instead of covering the card", () => {
    const result = computeOverlayPosition({
      ...base,
      overlayWidth: 960,
      overlayHeight: 612,
      viewportWidth: 1440,
      viewportHeight: 900,
      sourceRect: { top: 500, left: 40, right: 400, bottom: 702, width: 360, height: 202 }
    });

    expect(result.placement).toBe("right");
    expect(result.left).toBe(416);
    expect(result.top).toBe(900 - 612);
  });

  it("uses the left side when the card is near the right edge", () => {
    const result = computeOverlayPosition({
      ...base,
      sourceRect: { top: 100, left: 900, right: 1200, bottom: 270, width: 300, height: 170 }
    });

    expect(result.placement).toBe("left");
    expect(result.left).toBe(900 - 480 - 16);
  });

  it("falls back to covering the card when no side has room", () => {
    const result = computeOverlayPosition({
      ...base,
      overlayWidth: 1200,
      overlayHeight: 700,
      sourceRect: { top: 100, left: 300, right: 700, bottom: 325, width: 400, height: 225 }
    });

    expect(result.placement).toBe("fallback");
    expect(result.left).toBe(80);
    expect(result.top).toBe(100);
  });

  it("adds the page scroll offset", () => {
    const result = computeOverlayPosition({
      ...base,
      scrollX: 10,
      scrollY: 1000,
      sourceRect: { top: 20, left: 20, right: 220, bottom: 132, width: 200, height: 112 }
    });

    expect(result.left).toBe(246);
    expect(result.top).toBe(1020);
  });
});
