// YouTube's player API (setVolume, mute, ...) exists only in the page's own
// script context. The content script runs in an isolated context, so it asks
// a small page-context script (page-bridge.ts) to use the API for it.
// Both sides talk through DOM events on the preview iframe. Event details are
// JSON strings, because objects do not cross between the two contexts.

export const PLAYER_COMMAND_EVENT = "yhp:player-command";
export const PLAYER_STATE_EVENT = "yhp:player-state";

export type AudioState = {
  muted: boolean;
  volume: number;
};

export type PlayerCommand = { type: "read" } | ({ type: "apply" } & AudioState);

export function parseAudioState(detail: unknown): AudioState | null {
  if (typeof detail !== "string") return null;
  try {
    const value = JSON.parse(detail) as Partial<AudioState>;
    if (typeof value.muted !== "boolean" || typeof value.volume !== "number") return null;
    return { muted: value.muted, volume: value.volume };
  } catch {
    return null;
  }
}

export function parsePlayerCommand(detail: unknown): PlayerCommand | null {
  if (typeof detail !== "string") return null;
  try {
    const value = JSON.parse(detail) as { type?: unknown };
    if (value.type === "read") return { type: "read" };
    if (value.type !== "apply") return null;
    const state = parseAudioState(detail);
    return state ? { type: "apply", ...state } : null;
  } catch {
    return null;
  }
}
