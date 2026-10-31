export type Placement = "right" | "left" | "above" | "below" | "fallback";

type RectLike = Pick<DOMRect, "top" | "left" | "right" | "bottom" | "width" | "height">;

type PositioningInput = {
  sourceRect: RectLike;
  overlayWidth: number;
  overlayHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
  gap: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

// Places the overlay beside the thumbnail without covering it. A side
// placement may slide up or down (and an above/below placement left or
// right) to stay inside the viewport. Only when no side has room does the
// overlay fall back to covering the thumbnail.
export function computeOverlayPosition({
  sourceRect,
  overlayWidth,
  overlayHeight,
  viewportWidth,
  viewportHeight,
  scrollX,
  scrollY,
  gap
}: PositioningInput) {
  const fitsHeight = overlayHeight <= viewportHeight;
  const fitsWidth = overlayWidth <= viewportWidth;
  const sideTop = clamp(sourceRect.top, 0, viewportHeight - overlayHeight);
  const stackedLeft = clamp(sourceRect.left, 0, viewportWidth - overlayWidth);

  const candidates: Array<{ placement: Placement; left: number; top: number; fits: boolean }> = [
    {
      placement: "right",
      left: sourceRect.right + gap,
      top: sideTop,
      fits: fitsHeight && sourceRect.right + gap + overlayWidth <= viewportWidth
    },
    {
      placement: "left",
      left: sourceRect.left - overlayWidth - gap,
      top: sideTop,
      fits: fitsHeight && sourceRect.left - overlayWidth - gap >= 0
    },
    {
      placement: "above",
      left: stackedLeft,
      top: sourceRect.top - overlayHeight - gap,
      fits: fitsWidth && sourceRect.top - overlayHeight - gap >= 0
    },
    {
      placement: "below",
      left: stackedLeft,
      top: sourceRect.bottom + gap,
      fits: fitsWidth && sourceRect.bottom + gap + overlayHeight <= viewportHeight
    }
  ];

  const chosen = candidates.find((candidate) => candidate.fits) ?? {
    placement: "fallback" as const,
    left: Math.max(0, Math.min(sourceRect.left, viewportWidth - overlayWidth)),
    top: Math.max(0, Math.min(sourceRect.top, viewportHeight - overlayHeight))
  };

  return {
    placement: chosen.placement,
    left: chosen.left + scrollX,
    top: chosen.top + scrollY
  };
}
