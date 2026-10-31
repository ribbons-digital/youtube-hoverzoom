import type { SupportedPageType } from "../shared/page-types";
import { parseVideoId } from "../shared/youtube";

// yt-lockup-view-model is YouTube's newer card element. It replaces the
// older renderers on some surfaces, such as the watch page sidebar.
const CARD_SELECTOR = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-compact-video-renderer",
  "yt-lockup-view-model"
].join(", ");

const THUMBNAIL_SELECTOR = [
  "#thumbnail",
  'ytd-thumbnail a[href*="/watch"]',
  'a[class*="ContentImage"]',
  'a[class*="content-image"]',
  "yt-thumbnail-view-model",
  'a[href*="/watch"]'
].join(", ");

// Newer cards use camelCase classes (ytLockupMetadataViewModelTitle); older
// builds used BEM classes (yt-lockup-metadata-view-model__title).
const TITLE_SELECTOR = [
  "#video-title",
  '[class*="LockupMetadataViewModelTitle"]',
  '[class*="lockup-metadata-view-model"][class*="title"]',
  "h3"
].join(", ");

const METADATA_ROW_SELECTOR = [
  '[class*="ContentMetadataViewModelMetadataRow"]',
  '[class*="content-metadata-view-model"][class*="metadata-row"]'
].join(", ");

const METADATA_DELIMITER_SELECTOR = '[class*="Delimiter"], [class*="delimiter"]';

// ytd-channel-name also holds a tooltip with the same name, so read only its text node.
const CHANNEL_SELECTOR = ["ytd-channel-name #text", "#channel-name #text"].join(", ");

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
  const thumb = card.querySelector<HTMLElement>(THUMBNAIL_SELECTOR);
  const rect = thumb?.getBoundingClientRect();
  return rect && rect.width > 0 && rect.height > 0 ? rect : null;
}

function readText(element: Element | null | undefined) {
  const text = element?.textContent?.replace(/\s+/g, " ").trim();
  return text || undefined;
}

function extractChannel(card: HTMLElement) {
  const named = readText(card.querySelector(CHANNEL_SELECTOR));
  if (named) return named;

  // Newer cards may link to the channel; skip avatar links, which have no text.
  const links = card.querySelectorAll('a[href^="/@"], a[href^="/channel/"]');
  for (const link of links) {
    const text = readText(link);
    if (text) return text;
  }

  // Otherwise the channel is the first metadata row, when that row holds a
  // single value. On channel pages the first row holds views and age instead.
  const firstRow = card.querySelector(METADATA_ROW_SELECTOR);
  if (!firstRow || firstRow.querySelector(METADATA_DELIMITER_SELECTOR)) return undefined;
  return readText(firstRow);
}

export function extractMetadata(card: HTMLElement): { title?: string; channel?: string } {
  return {
    title: readText(card.querySelector(TITLE_SELECTOR)),
    channel: extractChannel(card)
  };
}

export function getPageType(url = new URL(window.location.href)): SupportedPageType {
  if (url.pathname === "/") return "home";
  if (url.pathname === "/results") return "search";
  if (url.pathname === "/feed/subscriptions") return "subscriptions";
  if (url.pathname === "/watch") return "watchSidebar";
  if (url.pathname.endsWith("/videos")) return "channelVideos";
  return "other";
}
