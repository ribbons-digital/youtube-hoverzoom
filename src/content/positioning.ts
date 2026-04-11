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
  const candidates: Array<{ placement: Placement; left: number; top: number }> = [
    { placement: "right", left: sourceRect.right + gap, top: sourceRect.top },
    { placement: "left", left: sourceRect.left - overlayWidth - gap, top: sourceRect.top },
    { placement: "above", left: sourceRect.left, top: sourceRect.top - overlayHeight - gap },
    { placement: "below", left: sourceRect.left, top: sourceRect.bottom + gap }
  ];

  const fit = candidates.find((candidate) => {
    return (
      candidate.left >= 0 &&
      candidate.top >= 0 &&
      candidate.left + overlayWidth <= viewportWidth &&
      candidate.top + overlayHeight <= viewportHeight
    );
  });

  const chosen = fit ?? {
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
