import { describe, expect, it } from "vitest";
import {
  extractMetadata,
  extractThumbnailRect,
  extractVideoId,
  findVideoCardFromTarget,
  getPageType,
  isSupportedCard
} from "../../src/content/selectors";

describe("YouTube selectors", () => {
  it("finds a standard rich-grid card from a nested target", () => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer>
        <a id="thumbnail" href="/watch?v=abc12345678"><img /></a>
        <a id="video-title">Example title</a>
        <ytd-channel-name>
          <yt-formatted-string id="text">Example channel</yt-formatted-string>
          <tp-yt-paper-tooltip>Example channel</tp-yt-paper-tooltip>
        </ytd-channel-name>
      </ytd-rich-item-renderer>
    `;

    const target = document.querySelector("img") as HTMLImageElement;
    const card = findVideoCardFromTarget(target);

    expect(card?.tagName.toLowerCase()).toBe("ytd-rich-item-renderer");
    expect(isSupportedCard(card as HTMLElement)).toBe(true);
    expect(extractVideoId(card as HTMLElement)).toBe("abc12345678");
    expect(extractMetadata(card as HTMLElement)).toEqual({
      title: "Example title",
      channel: "Example channel"
    });
  });

  it("detects page types and ignores shorts links", () => {
    expect(getPageType(new URL("https://www.youtube.com/results?search_query=test"))).toBe("search");
    expect(getPageType(new URL("https://www.youtube.com/feed/subscriptions"))).toBe("subscriptions");
    expect(getPageType(new URL("https://www.youtube.com/shorts/abc12345678"))).toBe("other");
  });

  it("returns null when no watch id is present", () => {
    document.body.innerHTML = `<ytd-rich-item-renderer><a href="/shorts/abc12345678">Short</a></ytd-rich-item-renderer>`;
    const card = document.querySelector("ytd-rich-item-renderer") as HTMLElement;
    expect(extractVideoId(card)).toBeNull();
  });

  it("prefers the thumbnail rect when available", () => {
    document.body.innerHTML = `<ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=abc12345678"></a></ytd-rich-item-renderer>`;
    const thumbnail = document.querySelector("#thumbnail") as HTMLElement;
    thumbnail.getBoundingClientRect =
      () =>
        ({
          top: 10,
          left: 20,
          width: 200,
          height: 112,
          right: 220,
          bottom: 122,
          x: 20,
          y: 10,
          toJSON() {
            return {};
          }
        }) as DOMRect;

    const card = document.querySelector("ytd-rich-item-renderer") as HTMLElement;
    const rect = extractThumbnailRect(card);
    expect(rect?.width).toBe(200);
  });

  it("supports the newer lockup card used by the watch sidebar", () => {
    document.body.innerHTML = `
      <yt-lockup-view-model>
        <a class="yt-lockup-view-model__content-image" href="/watch?v=lockup12345"><img /></a>
        <div class="yt-lockup-metadata-view-model">
          <a href="/@demo"><img alt="" /></a>
          <h3 class="yt-lockup-metadata-view-model__heading-reset">
            <a class="yt-lockup-metadata-view-model__title" href="/watch?v=lockup12345">Lockup   title</a>
          </h3>
          <a href="/@demo">Demo channel</a>
        </div>
      </yt-lockup-view-model>
    `;

    const card = findVideoCardFromTarget(document.querySelector("img"));

    expect(card?.tagName.toLowerCase()).toBe("yt-lockup-view-model");
    expect(extractVideoId(card as HTMLElement)).toBe("lockup12345");
    expect(extractMetadata(card as HTMLElement)).toEqual({ title: "Lockup title", channel: "Demo channel" });
  });

  it("ignores a thumbnail that has no size yet", () => {
    document.body.innerHTML = `<ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=abc12345678"></a></ytd-rich-item-renderer>`;
    const card = document.querySelector("ytd-rich-item-renderer") as HTMLElement;

    expect(extractThumbnailRect(card)).toBeNull();
  });
});
