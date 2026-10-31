import { PLAYER_COMMAND_EVENT, PLAYER_STATE_EVENT, parseAudioState, type AudioState, type PlayerCommand } from "./player-bridge";

const YT_WATCH_ORIGIN = "https://www.youtube.com";
const CLOSED_PLAYER_SRC = "about:blank";
const CLEANUP_STYLE_ID = "yhp-watch-cleanup";
const CLEANUP_POLL_INTERVAL_MS = 200;
const CLEANUP_POLL_TIMEOUT_MS = 20000;
// YouTube applies its own saved volume shortly after playback starts.
// Changes inside this window are YouTube's, not the viewer's, so ours wins.
const AUDIO_GUARD_MS = 1000;

// Strips watch-page chrome so the preview shows only the player. Live chat is
// the critical one: its close button is broken inside a constrained iframe.
// The player itself is pinned to fill the whole iframe viewport, because the
// watch page's own layout JS sizes it as if the hidden chrome were still there.
const CLEANUP_CSS = `
  #masthead-container,
  #masthead,
  ytd-mini-guide-renderer,
  tp-yt-app-drawer,
  #secondary,
  #below,
  ytd-comments,
  #chat,
  #chat-container,
  ytd-live-chat-frame,
  iframe#chatframe,
  #playlist,
  ytd-merch-shelf-renderer {
    display: none !important;
  }

  ytd-app #page-manager {
    margin-top: 0 !important;
  }

  html, body {
    overflow: hidden !important;
    background: #000 !important;
    scrollbar-width: none !important;
  }

  ::-webkit-scrollbar {
    width: 0 !important;
    height: 0 !important;
  }

  #movie_player {
    position: fixed !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: #000 !important;
    z-index: 2147483647 !important;
  }

  #movie_player .html5-video-container {
    width: 100% !important;
    height: 100% !important;
  }

  #movie_player video {
    width: 100% !important;
    height: 100% !important;
    left: 0 !important;
    top: 0 !important;
    object-fit: contain !important;
  }
`;

type PlayerOpenArgs = AudioState & {
  videoId: string;
};

type PlayerControllerOptions = {
  // Called when the viewer changes mute or volume inside the preview.
  onAudioChange?: (state: AudioState) => void;
  // Called when the viewer presses Escape while focus is inside the preview.
  onEscape?: () => void;
};

function buildWatchUrl(videoId: string): string {
  const url = new URL("/watch", YT_WATCH_ORIGIN);
  url.searchParams.set("v", videoId);
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("playsinline", "1");
  return url.toString();
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as Element | null;
  return typeof element?.matches === "function" && element.matches("input, textarea, [contenteditable='true']");
}

export function createPlayerController(host: HTMLElement, options: PlayerControllerOptions = {}) {
  let iframe: HTMLIFrameElement | null = null;
  let cleanupTimer: ReturnType<typeof setInterval> | null = null;
  let cleanupDeadline = 0;
  // The document that was in the frame before the latest src change. It is
  // skipped until the new watch page replaces it.
  let staleDocument: Document | null = null;
  let hookedVideo: HTMLVideoElement | null = null;
  let pendingAudio: AudioState | null = null;
  let lastAudio: AudioState | null = null;
  let audioGuardUntil = 0;
  let bridgeReply: AudioState | null = null;
  let applyingAudio = false;
  const hookedDocuments = new WeakSet<Document>();

  // Sends a command to the page bridge and returns the player's audio state,
  // or null while the player API is not ready. The bridge replies synchronously.
  const sendPlayerCommand = (command: PlayerCommand) => {
    if (!iframe) return null;
    bridgeReply = null;
    iframe.dispatchEvent(new CustomEvent(PLAYER_COMMAND_EVENT, { detail: JSON.stringify(command), bubbles: true }));
    return bridgeReply;
  };

  const sameAudio = (a: AudioState | null, b: AudioState | null) =>
    !!a && !!b && a.muted === b.muted && a.volume === b.volume;

  // Our own changes fire volumechange too; ignore those while they apply.
  const applyAudio = (state: AudioState) => {
    applyingAudio = true;
    try {
      return sendPlayerCommand({ type: "apply", ...state });
    } finally {
      applyingAudio = false;
    }
  };

  // Applies the requested audio once playback has started, because YouTube
  // sets up its own volume first. Returns true when nothing is left to apply.
  const tryApplyPendingAudio = () => {
    if (!pendingAudio) return true;
    if (!hookedVideo || hookedVideo.paused) return false;
    if (!applyAudio(pendingAudio)) return false;

    lastAudio = pendingAudio;
    pendingAudio = null;
    audioGuardUntil = Date.now() + AUDIO_GUARD_MS;
    return true;
  };

  const handleVolumeChange = () => {
    if (applyingAudio) return;
    if (pendingAudio) {
      tryApplyPendingAudio();
      return;
    }

    const state = sendPlayerCommand({ type: "read" });
    if (!state || sameAudio(state, lastAudio)) return;

    if (lastAudio && Date.now() < audioGuardUntil) {
      applyAudio(lastAudio);
      return;
    }

    lastAudio = state;
    options.onAudioChange?.(state);
  };

  const hookVideo = (video: HTMLVideoElement) => {
    if (video === hookedVideo) return;
    hookedVideo = video;
    // A new video element without a requested state (for example after a
    // full reload inside the frame) keeps the last known audio state.
    pendingAudio ??= lastAudio;
    video.addEventListener("playing", tryApplyPendingAudio);
    video.addEventListener("volumechange", handleVolumeChange);
  };

  const hookDocument = (doc: Document) => {
    if (hookedDocuments.has(doc)) return;
    hookedDocuments.add(doc);
    doc.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || isEditableTarget(event.target)) return;
      options.onEscape?.();
    });
  };

  // Returns true once the watch page is fully prepared: cleanup styles are in
  // place, the video element is hooked, and the requested audio is applied.
  const applyWatchCleanup = () => {
    if (!iframe) return false;

    try {
      const doc = iframe.contentDocument;
      if (!doc?.head || doc === staleDocument) return false;

      if (!doc.getElementById(CLEANUP_STYLE_ID)) {
        const style = doc.createElement("style");
        style.id = CLEANUP_STYLE_ID;
        style.textContent = CLEANUP_CSS;
        doc.head.append(style);
      }
      hookDocument(doc);

      doc.querySelector("ytd-live-chat-frame")?.setAttribute("collapsed", "");

      // The player JS sets inline sizes on its controls from the measured
      // player rect; fire a resize so it re-measures the now-fullscreen player.
      const moviePlayer = doc.querySelector<HTMLElement>("#movie_player");
      if (moviePlayer && moviePlayer.dataset.yhpResized !== "true") {
        moviePlayer.dataset.yhpResized = "true";
        iframe.contentWindow?.dispatchEvent(new Event("resize"));
      }

      const video = doc.querySelector<HTMLVideoElement>("#movie_player video, video");
      if (!video) return false;
      hookVideo(video);
      return tryApplyPendingAudio();
    } catch {
      // Frame is detached or (unexpectedly) cross-origin; nothing to clean up.
      return false;
    }
  };

  const stopCleanupPolling = () => {
    if (cleanupTimer === null) return;
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  };

  // The style node must be re-injected whenever the iframe gets a fresh
  // document. The load event alone fires too late (chat would flash in), so
  // poll until the watch page is prepared, then stop.
  const startCleanupPolling = () => {
    stopCleanupPolling();
    if (applyWatchCleanup()) return;
    cleanupDeadline = Date.now() + CLEANUP_POLL_TIMEOUT_MS;
    cleanupTimer = setInterval(() => {
      if (applyWatchCleanup() || Date.now() > cleanupDeadline) stopCleanupPolling();
    }, CLEANUP_POLL_INTERVAL_MS);
  };

  const ensureIframe = () => {
    if (iframe && iframe.isConnected) return iframe;

    iframe = document.createElement("iframe");
    iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.addEventListener("load", () => {
      applyWatchCleanup();
    });
    iframe.addEventListener(PLAYER_STATE_EVENT, (event) => {
      bridgeReply = parseAudioState((event as CustomEvent).detail);
    });
    host.replaceChildren(iframe);
    return iframe;
  };

  const loadVideo = (frame: HTMLIFrameElement, src: string) => {
    try {
      staleDocument = frame.contentDocument;
    } catch {
      staleDocument = null;
    }
    hookedVideo = null;
    frame.src = src;
  };

  const getEmbeddedVideo = () => {
    if (!iframe) return null;

    try {
      return iframe.contentDocument?.querySelector("video") as HTMLVideoElement | null;
    } catch {
      return null;
    }
  };

  const resumeEmbeddedVideo = () => {
    const video = getEmbeddedVideo();
    if (!video) return false;

    const playAttempt = video.play?.();
    void playAttempt?.catch?.(() => undefined);
    return true;
  };

  const pauseEmbeddedVideo = () => {
    const video = getEmbeddedVideo();
    if (!video) return false;

    video.pause?.();
    return true;
  };

  return {
    // A different video loads with the requested audio state. The same video
    // resumes where it stopped and keeps the audio the viewer left it with.
    open({ videoId, muted, volume }: PlayerOpenArgs) {
      const frame = ensureIframe();

      const nextSrc = buildWatchUrl(videoId);
      if (frame.src !== nextSrc) {
        pendingAudio = { muted, volume };
        loadVideo(frame, nextSrc);
        startCleanupPolling();
        return;
      }

      startCleanupPolling();
      resumeEmbeddedVideo();
    },

    pause() {
      stopCleanupPolling();
      pauseEmbeddedVideo();
    },

    reset() {
      stopCleanupPolling();
      if (!iframe) return;
      loadVideo(iframe, CLOSED_PLAYER_SRC);
    }
  };
}
