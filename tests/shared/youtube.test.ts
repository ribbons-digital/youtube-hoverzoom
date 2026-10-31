import { describe, expect, it } from "vitest";
import { isShortsUrl, parseVideoId } from "../../src/shared/youtube";

describe("YouTube links", () => {
  it("reads the video id from watch, short-link, and Shorts URLs", () => {
    expect(parseVideoId("/watch?v=abc12345678")).toBe("abc12345678");
    expect(parseVideoId("https://youtu.be/abc12345678")).toBe("abc12345678");
    expect(parseVideoId("/shorts/abc12345678")).toBe("abc12345678");
    expect(parseVideoId("https://www.youtube.com/shorts/abc12345678?feature=share")).toBe("abc12345678");
  });

  it("rejects links without a full video id", () => {
    expect(parseVideoId("/shorts/")).toBeNull();
    expect(parseVideoId("/shorts/abc")).toBeNull();
    expect(parseVideoId("/watch?v=abc")).toBeNull();
    expect(parseVideoId("/@demo/videos")).toBeNull();
  });

  it("detects Shorts links only", () => {
    expect(isShortsUrl("/shorts/abc12345678")).toBe(true);
    expect(isShortsUrl("/watch?v=abc12345678")).toBe(false);
    expect(isShortsUrl("/@demo/shorts")).toBe(false);
  });
});
