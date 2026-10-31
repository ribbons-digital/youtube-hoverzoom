const YT_WATCH_ORIGIN = "https://www.youtube.com";
const CLOSED_PLAYER_SRC = "about:blank";
const CLEANUP_STYLE_ID = "yhp-watch-cleanup";
const CLEANUP_POLL_INTERVAL_MS = 200;

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

type PlayerOpenArgs = {
  videoId: string;
  muted: boolean;
  volume: number;
};

function buildWatchUrl(videoId: string, muted: boolean): string {
  const url = new URL("/watch", YT_WATCH_ORIGIN);
  url.searchParams.set("v", videoId);
  url.searchParams.set("autoplay", "1");
  url.searchParams.set("playsinline", "1");
  if (muted) url.searchParams.set("mute", "1");
  return url.toString();
}

export function createPlayerController(host: HTMLElement) {
  let iframe: HTMLIFrameElement | null = null;
  let currentVideoId: string | null = null;
  let currentMuted = true;
  let cleanupTimer: ReturnType<typeof setInterval> | null = null;

  const applyWatchCleanup = () => {
    if (!iframe) return;

    try {
      const doc = iframe.contentDocument;
      if (!doc?.head) return;

      if (!doc.getElementById(CLEANUP_STYLE_ID)) {
        const style = doc.createElement("style");
        style.id = CLEANUP_STYLE_ID;
        style.textContent = CLEANUP_CSS;
        doc.head.append(style);
      }

      doc.querySelector("ytd-live-chat-frame")?.setAttribute("collapsed", "");

      // The player JS sets inline sizes on its controls from the measured
      // player rect; fire a resize so it re-measures the now-fullscreen player.
      const moviePlayer = doc.querySelector<HTMLElement>("#movie_player");
      if (moviePlayer && moviePlayer.dataset.yhpResized !== "true") {
        moviePlayer.dataset.yhpResized = "true";
        iframe.contentWindow?.dispatchEvent(new Event("resize"));
      }
    } catch {
      // Frame is detached or (unexpectedly) cross-origin; nothing to clean up.
    }
  };

  const stopCleanupPolling = () => {
    if (cleanupTimer === null) return;
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  };

  // The style node must be re-injected whenever the iframe gets a fresh
  // document. The load event alone fires too late (chat would flash in), so
  // poll while a watch page is loaded and inject as soon as <head> exists.
  const startCleanupPolling = () => {
    stopCleanupPolling();
    cleanupTimer = setInterval(applyWatchCleanup, CLEANUP_POLL_INTERVAL_MS);
  };

  const ensureIframe = () => {
    if (iframe && iframe.isConnected) return iframe;

    iframe = document.createElement("iframe");
    iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.addEventListener("load", applyWatchCleanup);
    host.replaceChildren(iframe);
    return iframe;
  };

  const loadWatchSurface = () => {
    if (!iframe || !currentVideoId) return;
    iframe.src = buildWatchUrl(currentVideoId, currentMuted);
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
    open({ videoId, muted }: PlayerOpenArgs) {
      const frame = ensureIframe();
      currentVideoId = videoId;
      currentMuted = muted;

      const nextSrc = buildWatchUrl(videoId, muted);
      if (frame.src !== nextSrc) {
        frame.src = nextSrc;
        startCleanupPolling();
        return;
      }

      startCleanupPolling();
      resumeEmbeddedVideo();
    },

    play() {
      startCleanupPolling();
      if (resumeEmbeddedVideo()) return;
      loadWatchSurface();
    },

    pause() {
      stopCleanupPolling();
      pauseEmbeddedVideo();
    },

    reset() {
      stopCleanupPolling();
      if (!iframe) return;
      iframe.src = CLOSED_PLAYER_SRC;
      currentVideoId = null;
    },

    mute() {},

    unmute() {},

    setVolume() {}
  };
}
