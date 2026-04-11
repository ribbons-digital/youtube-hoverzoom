import { describe, expect, it } from "vitest";
import { computeOverlayPosition } from "../../src/content/positioning";

describe("overlay positioning", () => {
  it("prefers the right side when there is room", () => {
    const result = computeOverlayPosition({
      sourceRect: { top: 20, left: 20, right: 220, bottom: 132, width: 200, height: 112 },
      overlayWidth: 480,
      overlayHeight: 270,
      viewportWidth: 1280,
      viewportHeight: 800,
      scrollX: 0,
      scrollY: 0,
      gap: 16
    });

    expect(result.placement).toBe("right");
    expect(result.left).toBe(236);
  });
});
