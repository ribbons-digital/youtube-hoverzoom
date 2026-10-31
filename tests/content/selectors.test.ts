import { describe, expect, it } from "vitest";
import {
  extractMetadata,
  extractThumbnailRect,
  extractVideoId,
  findVideoCardFromTarget,
  getPageType,
  isShortsCard,
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

  it("detects page types, including a channel's Shorts tab but not the Shorts player", () => {
    expect(getPageType(new URL("https://www.youtube.com/results?search_query=test"))).toBe("search");
    expect(getPageType(new URL("https://www.youtube.com/feed/subscriptions"))).toBe("subscriptions");
    expect(getPageType(new URL("https://www.youtube.com/@demo/videos"))).toBe("channelVideos");
    expect(getPageType(new URL("https://www.youtube.com/@demo/shorts"))).toBe("channelVideos");
    expect(getPageType(new URL("https://www.youtube.com/channel/UC123/shorts"))).toBe("channelVideos");
    expect(getPageType(new URL("https://www.youtube.com/shorts/abc12345678"))).toBe("other");
    expect(getPageType(new URL("https://www.youtube.com/shorts"))).toBe("other");
  });

  it("returns null when no video id is present", () => {
    document.body.innerHTML = `<ytd-rich-item-renderer><a href="/shorts/">Shorts</a></ytd-rich-item-renderer>`;
    const card = document.querySelector("ytd-rich-item-renderer") as HTMLElement;
    expect(extractVideoId(card)).toBeNull();
    expect(isSupportedCard(card)).toBe(false);
  });

  it("reads a Shorts card from the markup YouTube serves on home and search pages", () => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer>
        <ytm-shorts-lockup-view-model-v2 class="shortsLockupViewModelHost">
          <ytm-shorts-lockup-view-model class="shortsLockupViewModelHost">
            <a class="shortsLockupViewModelHostEndpoint reel-item-endpoint" href="/shorts/tvnXhIozvVo">
              <div class="shortsLockupViewModelHostThumbnailParentContainer">
                <yt-thumbnail-view-model class="ytThumbnailViewModelHost ytThumbnailViewModelAspectRatio2By3">
                  <div class="ytThumbnailViewModelImage"><img alt="" /></div>
                </yt-thumbnail-view-model>
              </div>
            </a>
            <div class="shortsLockupViewModelHostOutsideMetadata">
              <div>
                <h3 class="shortsLockupViewModelHostMetadataTitle">
                  <a class="shortsLockupViewModelHostEndpoint" href="/shorts/tvnXhIozvVo">
                    <span class="ytAttributedStringHost">Ranking The Best   Hairstyles</span>
                  </a>
                </h3>
                <div class="shortsLockupViewModelHostOutsideMetadataSubhead">
                  <span class="ytAttributedStringHost">4.1m views</span>
                </div>
              </div>
            </div>
          </ytm-shorts-lockup-view-model>
        </ytm-shorts-lockup-view-model-v2>
      </ytd-rich-item-renderer>
    `;
    const thumbnail = document.querySelector("yt-thumbnail-view-model") as HTMLElement;
    thumbnail.getBoundingClientRect = () => ({ top: 0, left: 0, width: 168, height: 252, right: 168, bottom: 252 }) as DOMRect;

    const card = findVideoCardFromTarget(document.querySelector("img")) as HTMLElement;

    expect(card.tagName.toLowerCase()).toBe("ytm-shorts-lockup-view-model");
    expect(isSupportedCard(card)).toBe(true);
    expect(isShortsCard(card)).toBe(true);
    expect(extractVideoId(card)).toBe("tvnXhIozvVo");
    expect(extractThumbnailRect(card)?.height).toBe(252);
    // The subhead holds the view count, so it must not be read as the channel.
    expect(extractMetadata(card)).toEqual({ title: "Ranking The Best Hairstyles", channel: undefined });
  });

  it("does not treat a normal video card as a Short", () => {
    document.body.innerHTML = `<ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=abc12345678"></a></ytd-rich-item-renderer>`;
    const card = document.querySelector("ytd-rich-item-renderer") as HTMLElement;
    expect(isShortsCard(card)).toBe(false);
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

  it("reads title and channel from the camelCase lockup markup YouTube serves on watch pages", () => {
    document.body.innerHTML = `
      <yt-lockup-view-model>
        <a href="/watch?v=1J4a9cT2lkw&amp;list=RD1J4a9cT2lkw" class="ytLockupViewModelContentImage">
          <yt-thumbnail-view-model><img alt="" /></yt-thumbnail-view-model>
        </a>
        <yt-lockup-metadata-view-model>
          <h3 class="ytLockupMetadataViewModelHeadingReset">
            <a href="/watch?v=1J4a9cT2lkw" class="ytLockupMetadataViewModelTitle"><span>Upbeat Lofi Mix</span></a>
          </h3>
          <yt-content-metadata-view-model>
            <div class="ytContentMetadataViewModelMetadataRow"><span>Lofi Shop 24h</span></div>
            <div class="ytContentMetadataViewModelMetadataRow">
              <span>1.6m</span><span class="ytContentMetadataViewModelDelimiter"> </span><span>2 years ago</span>
            </div>
          </yt-content-metadata-view-model>
        </yt-lockup-metadata-view-model>
      </yt-lockup-view-model>
    `;

    const card = findVideoCardFromTarget(document.querySelector("img")) as HTMLElement;

    expect(extractVideoId(card)).toBe("1J4a9cT2lkw");
    expect(extractMetadata(card)).toEqual({ title: "Upbeat Lofi Mix", channel: "Lofi Shop 24h" });
  });

  it("does not report views as the channel when the first row has several values", () => {
    document.body.innerHTML = `
      <yt-lockup-view-model>
        <a href="/watch?v=abc12345678"><img alt="" /></a>
        <div class="ytContentMetadataViewModelMetadataRow">
          <span>1.6m views</span><span class="ytContentMetadataViewModelDelimiter"> </span><span>2 years ago</span>
        </div>
      </yt-lockup-view-model>
    `;

    const card = findVideoCardFromTarget(document.querySelector("img")) as HTMLElement;

    expect(extractMetadata(card).channel).toBeUndefined();
  });
});
