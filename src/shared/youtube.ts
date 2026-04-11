export function parseVideoId(urlLike: string): string | null {
  let url: URL;
  try {
    url = new URL(urlLike, "https://www.youtube.com");
  } catch {
    return null;
  }

  if (url.pathname.startsWith("/shorts/")) return null;

  if (url.hostname === "youtu.be") {
    const candidate = url.pathname.slice(1);
    return candidate.length >= 11 ? candidate : null;
  }

  const fromQuery = url.searchParams.get("v");
  return fromQuery && fromQuery.length >= 11 ? fromQuery : null;
}
