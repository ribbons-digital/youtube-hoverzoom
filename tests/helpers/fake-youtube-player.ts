import { vi } from "vitest";

// A minimal stand-in for YouTube's #movie_player element and its API. Like the
// real player, every API change fires volumechange on the video element.
export function addFakeYouTubePlayer(doc: Document, initial = { volume: 100, muted: false }) {
  const state = { ...initial };
  const video = Object.assign(doc.createElement("video"), {
    play: vi.fn(async () => undefined),
    pause: vi.fn()
  });
  // JSDOM media elements are always paused; the real preview autoplays.
  Object.defineProperty(video, "paused", { value: false, writable: true, configurable: true });

  const notify = () => video.dispatchEvent(new Event("volumechange"));
  const moviePlayer = Object.assign(doc.createElement("div"), {
    id: "movie_player",
    getVolume: () => state.volume,
    isMuted: () => state.muted,
    setVolume: vi.fn((volume: number) => {
      state.volume = volume;
      notify();
    }),
    mute: vi.fn(() => {
      state.muted = true;
      notify();
    }),
    unMute: vi.fn(() => {
      state.muted = false;
      notify();
    })
  });
  moviePlayer.append(video);
  doc.body.append(moviePlayer);

  // Simulates a change made by the viewer in the player's own controls.
  const viewerChanges = (next: { volume?: number; muted?: boolean }) => {
    Object.assign(state, next);
    notify();
  };

  const setPaused = (paused: boolean) => {
    Object.defineProperty(video, "paused", { value: paused, writable: true, configurable: true });
  };

  return { video, moviePlayer, state, viewerChanges, setPaused };
}
