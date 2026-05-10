import { debugLog } from "./debug";
import { createOverlay } from "./overlay";
import { createPlayerController } from "./player-controller";
import { computeOverlayPosition } from "./positioning";
import { clampContentSettings, DEFAULT_CONTENT_SETTINGS, isContentPageEnabled } from "./runtime-settings";
import { getContentSettings } from "./runtime-storage";
import {
  extractMetadata,
  extractThumbnailRect,
  extractVideoId,
  findVideoCardFromTarget,
  getPageType,
  isSupportedCard
} from "./selectors";
import { createHoverStateMachine } from "./state-machine";
import type { HoverPlayerSettings } from "../shared/settings";

const LOCATION_CHANGE_EVENT = "yhp:locationchange";
const SCROLL_REOPEN_COOLDOWN_MS = 200;
const WATCH_MIN_OVERLAY_HEIGHT = 720;
const OVERLAY_CHROME_HEIGHT_WITH_METADATA = 72;
const OVERLAY_CHROME_HEIGHT_NO_METADATA = 44;

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

  const cardsById = new Map<string, HTMLElement>();
  const overlay = createOverlay();
  overlay.mount();

  const overlayElement = overlay.getElement();
  const playerHost = overlayElement.querySelector<HTMLElement>("#yhp-player-host");
  if (!playerHost) throw new Error("Missing #yhp-player-host");
  const player = createPlayerController(playerHost);

  const preserveOverlaySession = () => {
    overlay.hide();
    player.pause();
  };

  const discardOverlaySession = () => {
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

  const getEffectivePlayerHeight = () => Math.max(settings.overlayHeight, WATCH_MIN_OVERLAY_HEIGHT);
  const getOverlayOuterHeight = () =>
    getEffectivePlayerHeight() +
    (settings.showMetadata ? OVERLAY_CHROME_HEIGHT_WITH_METADATA : OVERLAY_CHROME_HEIGHT_NO_METADATA);

  const machine = createHoverStateMachine({
    hoverDelayMs: settings.hoverDelayMs,
    closeDelayMs: settings.closeDelayMs,
    onOpen: (cardId) => {
      const now = Date.now();
      if (now < scrollBlockedUntil) return;
      if (now - lastSwitchAt < 300) return;

      const card = cardsById.get(cardId);
      if (!card || !card.isConnected || !isSupportedCard(card)) return;

      const videoId = extractVideoId(card);
      if (!videoId) return;

      lastSwitchAt = now;

      const sourceRect = extractThumbnailRect(card) ?? card.getBoundingClientRect();
      const position = computeOverlayPosition({
        sourceRect,
        overlayWidth: settings.overlayWidth,
        overlayHeight: getOverlayOuterHeight(),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        gap: 16
      });

      const metadata = settings.showMetadata ? extractMetadata(card) : {};
      overlay.show({
        ...metadata,
        ...position,
        width: settings.overlayWidth,
        height: getEffectivePlayerHeight()
      });

      debugLog(settings.debug, "open", { cardId, videoId });
      player.open({
        videoId,
        muted: settings.defaultMuted,
        volume: settings.defaultVolume
      });
      machine.unpin();
      overlay.setPinned(false);
    },
    onClose: () => {
      debugLog(settings.debug, "close");
      preserveOverlaySession();
    }
  });

  const repositionCurrent = () => {
    if (machine.getSnapshot().mode !== "open") return;

    const cardId = machine.getSnapshot().currentCardId;
    if (!cardId) return;

    const card = cardsById.get(cardId);
    if (!card || !card.isConnected) {
      machine.forceReset();
      preserveOverlaySession();
      return;
    }

    const sourceRect = extractThumbnailRect(card) ?? card.getBoundingClientRect();
    const position = computeOverlayPosition({
      sourceRect,
      overlayWidth: settings.overlayWidth,
      overlayHeight: getOverlayOuterHeight(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      gap: 16
    });

    const metadata = settings.showMetadata ? extractMetadata(card) : {};
    overlay.show({
      ...metadata,
      ...position,
      width: settings.overlayWidth,
      height: getEffectivePlayerHeight()
    });
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

    const card = cardsById.get(snapshot.currentCardId);
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

    const card = cardsById.get(snapshot.currentCardId);
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
    if (!isContentPageEnabled(getPageType(), settings)) return;
    if (Date.now() < scrollBlockedUntil) return;
    if (machine.getSnapshot().pinned) return;

    lastPointer = {
      clientX: event.clientX,
      clientY: event.clientY
    };

    const card = findVideoCardFromTarget(event.target);
    if (!card || !isSupportedCard(card)) return;

    if (!card.dataset.yhpCardId) card.dataset.yhpCardId = randomId();
    const cardId = card.dataset.yhpCardId;
    cardsById.set(cardId, card);

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
      machine.forceReset();
      preserveOverlaySession();
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

  const handleLocationChange = () => {
    if (window.location.href === currentLocation) return;
    currentLocation = window.location.href;

    cardsById.clear();
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

  if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes.settings?.newValue) return;

      settings = clampContentSettings({
        ...DEFAULT_CONTENT_SETTINGS,
        ...(changes.settings.newValue as Partial<HoverPlayerSettings>)
      });

      if (!settings.enabled) {
        resetHoverSession("discard");
      }
    });
  }

  const historyAny = history as unknown as Record<string, (...args: unknown[]) => unknown>;

  const wrapHistoryMethod = (method: "pushState" | "replaceState") => {
    const original = historyAny[method];
    historyAny[method] = function (...args: unknown[]) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
      return result;
    };
  };

  wrapHistoryMethod("pushState");
  wrapHistoryMethod("replaceState");

  document.addEventListener("pointerover", handlePointerOver);
  document.addEventListener("pointerout", handlePointerOut);
  document.addEventListener("pointermove", (event) => {
    lastPointer = {
      clientX: event.clientX,
      clientY: event.clientY
    };

    reconcilePointerTarget(event.target, {
      clientX: event.clientX,
      clientY: event.clientY
    });
  });
  document.addEventListener("keydown", handleKeyDown);

  overlayElement.addEventListener("pointerenter", () => {
    const activeId = machine.getSnapshot().currentCardId;
    if (activeId) machine.pointerEntered(activeId);
  });
  overlayElement.addEventListener("pointerleave", (event) => {
    const pointerEvent = event as PointerEvent;
    reconcilePointerTarget(pointerEvent.relatedTarget, {
      clientX: pointerEvent.clientX,
      clientY: pointerEvent.clientY
    });
  });
  overlayElement.addEventListener("click", handleOverlayClick);

  window.addEventListener("resize", repositionCurrent);
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("blur", handleWindowExit);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") handleWindowExit();
  });
  window.addEventListener("popstate", () => {
    window.dispatchEvent(new Event(LOCATION_CHANGE_EVENT));
  });
  window.addEventListener(LOCATION_CHANGE_EVENT, handleLocationChange);
}

if (typeof chrome !== "undefined" && chrome.storage?.local && !window.__YHP_CONTENT_INSTALLED__) {
  window.__YHP_CONTENT_INSTALLED__ = true;
  void getContentSettings().then(bootstrapContentScript);
}
