export type HoverMode = "idle" | "hover_pending" | "open" | "closing";

type StateMachineOptions = {
  hoverDelayMs: number;
  closeDelayMs: number;
  onOpen: (cardId: string) => void;
  onClose: () => void;
};

export function createHoverStateMachine(options: StateMachineOptions) {
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

  return {
    pin() {
      pinned = true;
    },

    unpin() {
      pinned = false;
    },

    pointerEntered(cardId: string) {
      currentCardId = cardId;
      clearCloseTimer();

      if (mode === "open") return;

      mode = "hover_pending";
      clearHoverTimer();
      hoverTimer = window.setTimeout(() => {
        if (!currentCardId) return;
        mode = "open";
        options.onOpen(currentCardId);
      }, options.hoverDelayMs);
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
        clearCloseTimer();
        closeTimer = window.setTimeout(() => {
          mode = "idle";
          currentCardId = null;
          options.onClose();
        }, options.closeDelayMs);
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
}
