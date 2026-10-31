export type HoverMode = "idle" | "hover_pending" | "open" | "closing";

type StateMachineOptions = {
  hoverDelayMs: number;
  closeDelayMs: number;
  // Returns false when the card can no longer be opened, so the machine
  // goes back to idle instead of claiming an overlay that is not shown.
  onOpen: (cardId: string) => boolean;
  onClose: () => void;
};

export function createHoverStateMachine(options: StateMachineOptions) {
  let hoverDelayMs = options.hoverDelayMs;
  let closeDelayMs = options.closeDelayMs;
  let mode: HoverMode = "idle";
  let currentCardId: string | null = null;
  let hoverTimer: number | null = null;
  let closeTimer: number | null = null;
  let pinned = false;

  const clearHoverTimer = () => {
    if (hoverTimer !== null) window.clearTimeout(hoverTimer);
    hoverTimer = null;
  };

  const clearCloseTimer = () => {
    if (closeTimer !== null) window.clearTimeout(closeTimer);
    closeTimer = null;
  };

  // The overlay stays visible until this timer fires, even if the pointer
  // has meanwhile started a hover on another card.
  const startCloseTimer = () => {
    clearCloseTimer();
    closeTimer = window.setTimeout(() => {
      closeTimer = null;
      if (mode === "closing") {
        mode = "idle";
        currentCardId = null;
      }
      options.onClose();
    }, closeDelayMs);
  };

  const startHoverTimer = () => {
    clearHoverTimer();
    hoverTimer = window.setTimeout(() => {
      hoverTimer = null;
      if (!currentCardId) return;
      clearCloseTimer();
      mode = "open";
      if (!options.onOpen(currentCardId)) {
        mode = "idle";
        currentCardId = null;
      }
    }, hoverDelayMs);
  };

  const machine = {
    pin() {
      pinned = true;
    },

    unpin() {
      pinned = false;
    },

    setDelays(next: { hoverDelayMs: number; closeDelayMs: number }) {
      hoverDelayMs = next.hoverDelayMs;
      closeDelayMs = next.closeDelayMs;
    },

    pointerEntered(cardId: string) {
      if (cardId === currentCardId) {
        if (mode === "open" || mode === "hover_pending") return;
        if (mode === "closing") {
          clearCloseTimer();
          mode = "open";
          return;
        }
      }

      if (mode === "open") {
        if (pinned) return;
        mode = "closing";
        startCloseTimer();
      }

      currentCardId = cardId;
      mode = "hover_pending";
      startHoverTimer();
    },

    pointerLeft() {
      if (mode === "hover_pending") {
        clearHoverTimer();
        mode = "idle";
        currentCardId = null;
        return;
      }

      if (mode === "open") {
        if (pinned) return;
        mode = "closing";
        startCloseTimer();
      }
    },

    forceReset() {
      clearHoverTimer();
      clearCloseTimer();
      currentCardId = null;
      mode = "idle";
      pinned = false;
    },

    getSnapshot() {
      return { mode, currentCardId, pinned };
    }
  };

  return machine;
}
