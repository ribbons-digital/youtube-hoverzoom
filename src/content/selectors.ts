import type { SupportedPageType } from "../shared/page-types";
import { parseVideoId } from "../shared/youtube";

const CARD_SELECTOR = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-compact-video-renderer"
].join(", ");

export function findVideoCardFromTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(CARD_SELECTOR) : null;
}

export function extractVideoUrl(card: HTMLElement): string | null {
  const link = card.querySelector<HTMLAnchorElement>('a[href*="/watch"]');
  return link?.getAttribute("href") ?? null;
}

export function extractVideoId(card: HTMLElement): string | null {
  const href = extractVideoUrl(card);
  return href ? parseVideoId(href) : null;
}

export function isSupportedCard(card: HTMLElement): boolean {
  return !!extractVideoId(card);
}

export function extractThumbnailRect(card: HTMLElement): DOMRect | null {
  const thumb = card.querySelector<HTMLElement>('#thumbnail, ytd-thumbnail a[href*="/watch"], a[href*="/watch"]');
  return thumb?.getBoundingClientRect() ?? null;
}

export function extractMetadata(card: HTMLElement): { title?: string; channel?: string } {
  const title = card.querySelector<HTMLElement>("#video-title")?.textContent?.trim() ?? undefined;
  const channel =
    card.querySelector<HTMLElement>("ytd-channel-name, #channel-name")?.textContent?.trim() ?? undefined;
  return { title, channel };
}

export function getPageType(url = new URL(window.location.href)): SupportedPageType {
  if (url.pathname === "/") return "home";
  if (url.pathname === "/results") return "search";
  if (url.pathname === "/feed/subscriptions") return "subscriptions";
  if (url.pathname === "/watch") return "watchSidebar";
  if (url.pathname.endsWith("/videos")) return "channelVideos";
  return "other";
}
