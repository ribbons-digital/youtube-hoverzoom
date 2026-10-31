import { debugLog } from "./debug";
import { createOverlay } from "./overlay";
import { createPlayerController } from "./player-controller";
import { computeOverlayPosition } from "./positioning";
import {
  extractMetadata,
  extractThumbnailRect,
  extractVideoId,
  findVideoCardFromTarget,
  getPageType,
  isShortsCard,
  isSupportedCard
} from "./selectors";
import { createHoverStateMachine } from "./state-machine";
import { getShortsWidth, isPageEnabled, normalizeSettings, type HoverPlayerSettings } from "../shared/settings";
import { getSettings, saveLiveAudioState, SETTINGS_KEY } from "../shared/storage";

const SCROLL_REOPEN_COOLDOWN_MS = 200;
const SWITCH_COOLDOWN_MS = 300;
// Dragging the volume slider fires many changes; save only the final value.
const AUDIO_SAVE_DELAY_MS = 400;
const OVERLAY_GAP_PX = 16;
const ACTIVE_PAGE_ATTRIBUTE = "data-yhp-active";
const NATIVE_PREVIEW_VIDEO_SELECTOR = "ytd-video-preview video, #video-preview video";

declare global {
  interface Window {
    __YHP_CONTENT_INSTALLED__?: boolean;
  }
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `yhp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && target.matches("input, textarea, [contenteditable='true']");
}

export function bootstrapContentScript(initialSettings: HoverPlayerSettings) {
  let settings = { ...initialSettings };
  let currentLocation = window.location.href;
  let lastSwitchAt = 0;
  let scrollBlockedUntil = 0;
  let lastPointer: { clientX: number; clientY: number } | null = null;
  let audioSaveTimer: number | undefined;

  // Removes every listener in destroy(), so tests and re-injection start clean.
  const listeners = new AbortController();
  const { signal } = listeners;

  const overlay = createOverlay();
  overlay.mount();

  const overlayElement = overlay.getElement();
  const playerHost = overlayElement.querySelector<HTMLElement>("#yhp-player-host");
  if (!playerHost) throw new Error("Missing #yhp-player-host");

  // Cards are found through their data attribute instead of a stored map, so
  // cards that YouTube removes from the page are never kept in memory.
  // Card ids come from randomId(), so they are safe inside the selector.
  const getCard = (cardId: string) => document.querySelector<HTMLElement>(`[data-yhp-card-id="${cardId}"]`);

  const isActiveOnCurrentPage = () => isPageEnabled(getPageType(), settings);

  const canPreviewCard = (card: HTMLElement) =>
    isSupportedCard(card) && (settings.enableShorts || !isShortsCard(card));

  const updateActivePageAttribute = () => {
    document.documentElement.toggleAttribute(ACTIVE_PAGE_ATTRIBUTE, isActiveOnCurrentPage());
  };

  const pauseNativePreview = () => {
    document.querySelectorAll<HTMLVideoElement>(NATIVE_PREVIEW_VIDEO_SELECTOR).forEach((video) => {
      video.pause?.();
    });
  };

  // A hidden native preview still plays and downloads, so stop it each time
  // it starts. Media events do not bubble, so this listens in the capture phase.
  const handleMediaPlaying = (event: Event) => {
    const target = event.target;
    if (!(target instanceof HTMLVideoElement) || !target.matches(NATIVE_PREVIEW_VIDEO_SELECTOR)) return;
    if (isActiveOnCurrentPage()) target.pause?.();
  };

  const preserveOverlaySession = () => {
    overlay.setPinned(false);
    overlay.hide();
    player.pause();
  };

  const discardOverlaySession = () => {
    overlay.setPinned(false);
    overlay.hide();
    player.reset();
  };

  const resetHoverSession = (resetMode: "preserve" | "discard" = "preserve") => {
    machine.forceReset();
    if (resetMode === "discard") {
      discardOverlaySession();
      return;
    }

    preserveOverlaySession();
  };

  const player = createPlayerController(playerHost, {
    onAudioChange: (state) => {
      settings = { ...settings, defaultMuted: state.muted, defaultVolume: state.volume };
      debugLog(settings.debug, "audio", state);
      window.clearTimeout(audioSaveTimer);
      audioSaveTimer = window.setTimeout(() => {
        void saveLiveAudioState({ defaultMuted: state.muted, defaultVolume: state.volume }).catch((error) => {
          debugLog(settings.debug, "audio save failed", error);
        });
      }, AUDIO_SAVE_DELAY_MS);
    },
    onEscape: () => resetHoverSession()
  });

  // Shows the overlay for a card and places it beside the card's thumbnail.
  const showOverlayForCard = (card: HTMLElement) => {
    const metadata = settings.showMetadata ? extractMetadata(card) : {};
    const width = isShortsCard(card) ? getShortsWidth(settings.overlayHeight) : settings.overlayWidth;
    const outerHeight = overlay.show({
      ...metadata,
      width,
      height: settings.overlayHeight
    });

    const sourceRect = extractThumbnailRect(card) ?? card.getBoundingClientRect();
    const position = computeOverlayPosition({
      sourceRect,
      overlayWidth: width,
      overlayHeight: outerHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      gap: OVERLAY_GAP_PX
    });
    overlay.setPosition(position.left, position.top);
  };

  const machine = createHoverStateMachine({
    hoverDelayMs: settings.hoverDelayMs,
    closeDelayMs: settings.closeDelayMs,
    onOpen: (cardId) => {
      const now = Date.now();
      if (now < scrollBlockedUntil) return false;
      if (now - lastSwitchAt < SWITCH_COOLDOWN_MS) return false;

      const card = getCard(cardId);
      if (!card || !canPreviewCard(card)) return false;

      const videoId = extractVideoId(card);
      if (!videoId) return false;

      lastSwitchAt = now;
      overlay.setPinned(false);
      showOverlayForCard(card);
      pauseNativePreview();

      debugLog(settings.debug, "open", { cardId, videoId });
      player.open({
        videoId,
        muted: settings.defaultMuted,
        volume: settings.defaultVolume
      });
      return true;
    },
    onClose: () => {
      debugLog(settings.debug, "close");
      preserveOverlaySession();
    }
  });

  const repositionCurrent = () => {
    const snapshot = machine.getSnapshot();
    if (snapshot.mode !== "open" || snapshot.pinned || !snapshot.currentCardId) return;

    const card = getCard(snapshot.currentCardId);
    if (!card) {
      resetHoverSession();
      return;
    }

    showOverlayForCard(card);
  };

  const isPointerWithinRect = (pointer: { clientX: number; clientY: number } | null, rect: DOMRect) => {
    if (!pointer) return false;
    if (!Number.isFinite(pointer.clientX) || !Number.isFinite(pointer.clientY)) return false;
    if (rect.width <= 0 || rect.height <= 0) return false;

    return (
      pointer.clientX >= rect.left &&
      pointer.clientX <= rect.right &&
      pointer.clientY >= rect.top &&
      pointer.clientY <= rect.bottom
    );
  };

  const isPointerWithinActiveHoverFootprint = (pointer: { clientX: number; clientY: number } | null) => {
    const snapshot = machine.getSnapshot();
    if (!snapshot.currentCardId) return false;

    const card = getCard(snapshot.currentCardId);
    const withinCard = !!card && isPointerWithinRect(pointer, card.getBoundingClientRect());
    const withinOverlay = isPointerWithinRect(pointer, overlayElement.getBoundingClientRect());
    return withinCard || withinOverlay;
  };

  const reconcilePointerTarget = (
    target: EventTarget | null,
    pointer: { clientX: number; clientY: number } | null = null
  ) => {
    const snapshot = machine.getSnapshot();
    if (snapshot.mode !== "hover_pending" && snapshot.mode !== "open" && snapshot.mode !== "closing") return;
    if (!snapshot.currentCardId) return;

    const card = getCard(snapshot.currentCardId);
    const withinOverlay = target instanceof Node && overlayElement.contains(target);
    const withinOverlayByPointer = isPointerWithinRect(pointer, overlayElement.getBoundingClientRect());
    const withinCardByTarget = !!card && target instanceof Node && card.contains(target);
    const withinCardByPointer = !!card && isPointerWithinRect(pointer, card.getBoundingClientRect());
    const withinCard = withinCardByTarget || withinCardByPointer;

    if (snapshot.mode === "hover_pending") {
      if (!withinCard) {
        machine.pointerLeft();
      }
      return;
    }

    if (withinOverlay || withinOverlayByPointer || withinCard) {
      machine.pointerEntered(snapshot.currentCardId);
    } else {
      machine.pointerLeft();
    }
  };

  const handlePointerOver = (event: PointerEvent) => {
    if (!isActiveOnCurrentPage()) return;
    if (Date.now() < scrollBlockedUntil) return;
    if (machine.getSnapshot().pinned) return;

    lastPointer = {
      clientX: event.clientX,
      clientY: event.clientY
    };

    const card = findVideoCardFromTarget(event.target);
    if (!card || !canPreviewCard(card)) return;

    if (!card.dataset.yhpCardId) card.dataset.yhpCardId = randomId();
    const cardId = card.dataset.yhpCardId;

    debugLog(settings.debug, "pointerover", cardId);
    machine.pointerEntered(cardId);
  };

  const handlePointerOut = (event: PointerEvent) => {
    lastPointer = {
      clientX: event.clientX,
      clientY: event.clientY
    };

    if (!(event.relatedTarget instanceof Node)) {
      if (machine.getSnapshot().pinned) return;
      resetHoverSession();
      return;
    }

    reconcilePointerTarget(event.relatedTarget, {
      clientX: event.clientX,
      clientY: event.clientY
    });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || isEditableTarget(event.target)) return;
    resetHoverSession();
  };

  const handleOverlayClick = (event: Event) => {
    const action = (event.target as HTMLElement)
      ?.closest<HTMLElement>("[data-action]")
      ?.getAttribute("data-action");

    if (!action) return;

    if (action === "close") {
      resetHoverSession();
      return;
    }

    if (action === "pin-toggle") {
      const snapshot = machine.getSnapshot();
      if (snapshot.pinned) {
        machine.unpin();
        overlay.setPinned(false);
        reconcilePointerTarget(null, lastPointer);
      } else {
        machine.pin();
        overlay.setPinned(true);
      }
      return;
    }
  };

  // YouTube is a single-page app. Its own history calls happen in the page's
  // script context, which a content script cannot patch, so listen for the
  // navigation events YouTube dispatches on the document instead.
  const handleNavigateStart = () => {
    resetHoverSession("discard");
  };

  const handleLocationChange = () => {
    updateActivePageAttribute();
    if (window.location.href === currentLocation) return;
    currentLocation = window.location.href;
    resetHoverSession("discard");
  };

  const handleScroll = () => {
    scrollBlockedUntil = Date.now() + SCROLL_REOPEN_COOLDOWN_MS;
    if (machine.getSnapshot().pinned) return;
    resetHoverSession();
  };

  const handleWindowExit = () => {
    if (machine.getSnapshot().pinned) return;
    if (document.visibilityState !== "hidden" && isPointerWithinActiveHoverFootprint(lastPointer)) {
      return;
    }

    resetHoverSession();
  };

  const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName !== "local" || !changes[SETTINGS_KEY]?.newValue) return;

    settings = normalizeSettings(changes[SETTINGS_KEY].newValue);
    machine.setDelays({ hoverDelayMs: settings.hoverDelayMs, closeDelayMs: settings.closeDelayMs });
    updateActivePageAttribute();

    const currentCardId = machine.getSnapshot().currentCardId;
    const currentCard = currentCardId ? getCard(currentCardId) : null;
    if (!isActiveOnCurrentPage() || (currentCard && !canPreviewCard(currentCard))) {
      resetHoverSession("discard");
      return;
    }

    repositionCurrent();
  };

  const hasStorageEvents = typeof chrome !== "undefined" && !!chrome.storage?.onChanged;
  if (hasStorageEvents) {
    chrome.storage.onChanged.addListener(handleStorageChange);
  }

  updateActivePageAttribute();

  document.addEventListener("pointerover", handlePointerOver, { signal });
  document.addEventListener("pointerout", handlePointerOut, { signal });
  document.addEventListener(
    "pointermove",
    (event) => {
      lastPointer = {
        clientX: event.clientX,
        clientY: event.clientY
      };

      reconcilePointerTarget(event.target, {
        clientX: event.clientX,
        clientY: event.clientY
      });
    },
    { signal }
  );
  document.addEventListener("keydown", handleKeyDown, { signal });
  document.addEventListener("playing", handleMediaPlaying, { capture: true, signal });

  overlayElement.addEventListener(
    "pointerenter",
    () => {
      const activeId = machine.getSnapshot().currentCardId;
      if (activeId) machine.pointerEntered(activeId);
    },
    { signal }
  );
  overlayElement.addEventListener(
    "pointerleave",
    (event) => {
      const pointerEvent = event as PointerEvent;
      reconcilePointerTarget(pointerEvent.relatedTarget, {
        clientX: pointerEvent.clientX,
        clientY: pointerEvent.clientY
      });
    },
    { signal }
  );
  overlayElement.addEventListener("click", handleOverlayClick, { signal });

  window.addEventListener("resize", repositionCurrent, { signal });
  window.addEventListener("scroll", handleScroll, { passive: true, signal });
  window.addEventListener("blur", handleWindowExit, { signal });
  document.addEventListener(
    "visibilitychange",
    () => {
      if (document.visibilityState === "hidden") handleWindowExit();
    },
    { signal }
  );
  document.addEventListener("yt-navigate-start", handleNavigateStart, { signal });
  document.addEventListener("yt-navigate-finish", handleLocationChange, { signal });
  window.addEventListener("popstate", handleLocationChange, { signal });

  return {
    destroy() {
      window.clearTimeout(audioSaveTimer);
      listeners.abort();
      if (hasStorageEvents) chrome.storage.onChanged.removeListener(handleStorageChange);
      resetHoverSession("discard");
      overlayElement.remove();
      document.documentElement.removeAttribute(ACTIVE_PAGE_ATTRIBUTE);
    }
  };
}

if (
  typeof chrome !== "undefined" &&
  chrome.storage?.local &&
  window.self === window.top &&
  !window.__YHP_CONTENT_INSTALLED__
) {
  window.__YHP_CONTENT_INSTALLED__ = true;
  void getSettings().then(bootstrapContentScript);
}
