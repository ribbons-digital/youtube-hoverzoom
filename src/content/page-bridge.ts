import { parsePlayerCommand, PLAYER_COMMAND_EVENT, PLAYER_STATE_EVENT } from "./player-bridge";

type YouTubePlayerElement = HTMLElement & {
  setVolume?: (volume: number) => void;
  getVolume?: () => number;
  mute?: () => void;
  unMute?: () => void;
  isMuted?: () => boolean;
};

function findPlayer(frame: HTMLIFrameElement): YouTubePlayerElement | null {
  try {
    return frame.contentDocument?.querySelector<YouTubePlayerElement>("#movie_player") ?? null;
  } catch {
    return null;
  }
}

// Runs in the page's script context. Answers commands from the content script
// for the preview iframe only, and replies with the player's audio state.
// It does not reply while the player API is not ready yet.
export function installPageBridge(root: Document = document) {
  const handleCommand = (event: Event) => {
    const frame = event.target;
    if (!(frame instanceof HTMLIFrameElement) || !frame.closest("#yhp-overlay")) return;

    const command = parsePlayerCommand((event as CustomEvent).detail);
    const player = findPlayer(frame);
    if (!command || !player) return;
    if (typeof player.getVolume !== "function" || typeof player.isMuted !== "function") return;

    if (command.type === "apply") {
      player.setVolume?.(command.volume);
      if (command.muted) {
        player.mute?.();
      } else {
        player.unMute?.();
      }
    }

    const state = { muted: player.isMuted(), volume: Math.round(player.getVolume()) };
    frame.dispatchEvent(new CustomEvent(PLAYER_STATE_EVENT, { detail: JSON.stringify(state) }));
  };

  root.addEventListener(PLAYER_COMMAND_EVENT, handleCommand);
  return () => root.removeEventListener(PLAYER_COMMAND_EVENT, handleCommand);
}
