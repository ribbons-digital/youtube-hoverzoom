const SHORTS_PATH_PREFIX = "/shorts/";

function toUrl(urlLike: string): URL | null {
  try {
    return new URL(urlLike, "https://www.youtube.com");
  } catch {
    return null;
  }
}

export function isShortsUrl(urlLike: string): boolean {
  return toUrl(urlLike)?.pathname.startsWith(SHORTS_PATH_PREFIX) ?? false;
}

export function parseVideoId(urlLike: string): string | null {
  const url = toUrl(urlLike);
  if (!url) return null;

  // A Short uses a normal video ID, so it plays on the normal watch page too.
  if (url.pathname.startsWith(SHORTS_PATH_PREFIX)) {
    const candidate = url.pathname.slice(SHORTS_PATH_PREFIX.length).split("/")[0];
    return candidate.length >= 11 ? candidate : null;
  }

  if (url.hostname === "youtu.be") {
    const candidate = url.pathname.slice(1);
    return candidate.length >= 11 ? candidate : null;
  }

  const fromQuery = url.searchParams.get("v");
  return fromQuery && fromQuery.length >= 11 ? fromQuery : null;
}
