import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installPageBridge } from "../../src/content/page-bridge";
import { PLAYER_COMMAND_EVENT, PLAYER_STATE_EVENT } from "../../src/content/player-bridge";
import { addFakeYouTubePlayer } from "../helpers/fake-youtube-player";

describe("page bridge", () => {
  let removeBridge: () => void;

  beforeEach(() => {
    removeBridge = installPageBridge();
  });

  afterEach(() => {
    removeBridge();
  });

  const setup = (insideOverlay: boolean) => {
    document.body.innerHTML = insideOverlay ? `<div id="yhp-overlay"><iframe></iframe></div>` : `<iframe></iframe>`;
    const frame = document.querySelector("iframe") as HTMLIFrameElement;
    const doc = document.implementation.createHTMLDocument("watch");
    Object.defineProperty(frame, "contentDocument", { value: doc, configurable: true });
    const replies: string[] = [];
    frame.addEventListener(PLAYER_STATE_EVENT, (event) => replies.push((event as CustomEvent).detail));
    const send = (command: unknown) =>
      frame.dispatchEvent(new CustomEvent(PLAYER_COMMAND_EVENT, { detail: JSON.stringify(command), bubbles: true }));
    return { doc, replies, send };
  };

  it("applies audio with the player API and replies with the new state", () => {
    const { doc, replies, send } = setup(true);
    const { state } = addFakeYouTubePlayer(doc, { volume: 100, muted: true });

    send({ type: "apply", muted: false, volume: 45 });

    expect(state).toEqual({ volume: 45, muted: false });
    expect(replies.map((reply) => JSON.parse(reply))).toEqual([{ muted: false, volume: 45 }]);
  });

  it("does not reply while the player API is not ready", () => {
    const { doc, replies, send } = setup(true);
    doc.body.append(Object.assign(doc.createElement("div"), { id: "movie_player" }));

    send({ type: "read" });

    expect(replies).toEqual([]);
  });

  it("ignores frames outside the preview overlay and malformed commands", () => {
    const outside = setup(false);
    addFakeYouTubePlayer(outside.doc);
    outside.send({ type: "read" });
    expect(outside.replies).toEqual([]);

    const inside = setup(true);
    const { state } = addFakeYouTubePlayer(inside.doc);
    inside.send({ type: "apply", muted: "no", volume: 10 });
    expect(state.volume).toBe(100);
    expect(inside.replies).toEqual([]);
  });
});
