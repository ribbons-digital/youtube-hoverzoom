const YT_WATCH_ORIGIN = "https://www.youtube.com";
const CLOSED_PLAYER_SRC = "about:blank";

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

  const ensureIframe = () => {
    if (iframe && iframe.isConnected) return iframe;

    iframe = document.createElement("iframe");
    iframe.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
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
        return;
      }

      resumeEmbeddedVideo();
    },

    play() {
      if (resumeEmbeddedVideo()) return;
      loadWatchSurface();
    },

    pause() {
      pauseEmbeddedVideo();
    },

    reset() {
      if (!iframe) return;
      iframe.src = CLOSED_PLAYER_SRC;
      currentVideoId = null;
    },

    mute() {},

    unmute() {},

    setVolume() {}
  };
}
