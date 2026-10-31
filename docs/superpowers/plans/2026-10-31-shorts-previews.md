# Shorts previews plan

Status: approved and built on `feat/shorts-previews`.
Date: 31 October 2026.

## Outcome

A viewer hovers a Shorts card, and a tall preview plays beside it.
It works the same way as a normal video preview: the same delays, pinning, audio memory, and Escape to close.
Success: the viewer can skim Shorts without opening YouTube's Shorts player.

## Decisions

| Topic | Decision |
| --- | --- |
| Goal | Same behavior as normal video previews. |
| Size | Height comes from the "Preview height" setting. Width is 9:16 of it. 540 px tall gives 304 px wide. No new size setting. |
| Switch | New "Preview Shorts" setting in the options page, on by default. |
| Pages | Every page that already has previews, plus a channel's Shorts tab under the existing channel switch. |

## Live findings (31 October 2026, signed out)

- A Short opened as `/watch?v=<id>` stays on the normal watch page. YouTube does not redirect it to the Shorts player.
- The player API that the audio bridge uses (`setVolume`, `isMuted`) is present.
- The existing cleanup styles work unchanged. In a 304 x 540 box the video fills the box with no black bars.
- Home and search results use the same card: `ytm-shorts-lockup-view-model`.
- The card holds a thumbnail link `a.reel-item-endpoint` with `href="/shorts/<id>"`, and an `h3` title link.
- The card has no channel name. Its metadata row holds the view count.

## Scope

In scope:

- Shorts cards on home, search, subscriptions, watch sidebar, and channel Videos and Shorts tabs, when that page's switch is on.
- The new "Preview Shorts" switch.
- Tests and README updates.

Out of scope:

- YouTube's own Shorts player page (`/shorts/<id>`) and its swipe feed.
- Separate Shorts size settings.

## Approach

Work on a new branch, `feat/shorts-previews`.

1. Video links: [src/shared/youtube.ts](../../../src/shared/youtube.ts)
   - Accept `/shorts/<id>` links and return the 11-character video ID.
   - Add `isShortsUrl(href)` so callers know the card is a Short.
2. Cards: [src/content/selectors.ts](../../../src/content/selectors.ts)
   - Add `ytm-shorts-lockup-view-model` to the card selector.
   - Find the video link with `a[href*="/watch"], a[href*="/shorts/"]`.
   - Add the `reel-item-endpoint` link to the thumbnail selector.
   - Return no channel for Shorts cards. Otherwise the view count would show as the channel name.
   - Treat `/@name/shorts` and `/channel/<id>/shorts` as the channel page type.
3. Settings: [src/shared/settings.ts](../../../src/shared/settings.ts)
   - Add `enableShorts: boolean`, default `true`.
   - Saved settings from older versions get the default, because `normalizeSettings` fills missing keys.
4. Preview: [src/content/content.ts](../../../src/content/content.ts)
   - When the card is a Short and `enableShorts` is off, do not open a preview.
   - For a Short, use width `round(overlayHeight * 9 / 16)` for both the overlay and its placement.
   - The player keeps the same `/watch?v=<id>` page, cleanup, and audio bridge.
5. Options page: [src/options/main.ts](../../../src/options/main.ts)
   - Add the "Preview Shorts" checkbox in the Pages group.
   - Rename the "Channel videos" label to "Channel videos and Shorts".
   - Add a hint under "Preview height" that Shorts use this height with a tall width.
6. README
   - Remove "Shorts are not supported".
   - Add the new setting to the settings table.
   - Explain the Shorts preview size.
   - Add Shorts steps to the manual test checklist.

## Unknowns

- Channel Shorts tab markup. Channel pages did not render in the browser pane, so this is not checked.
- Resolved: YouTube plays its own hover preview on Shorts cards in `ytd-video-preview`. The extension already hides and pauses that element, so no new code is needed.
- Signed-in behavior, including whether a Shorts preview adds to watch history.
- Shorts cards on the subscriptions page and in the watch sidebar. These are not checked yet.

## Checks

Automated, inside the `hoverzoom` Docker Sandbox:

- Unit tests for `/shorts/` links, including invalid IDs.
- Selector tests that use the real Shorts card markup from the live page.
- Content tests: a Short opens a 304 x 540 preview, and no preview opens when the switch is off.
- Settings and options tests for the new switch.
- `pnpm lint`, `pnpm check`, `pnpm test`, and `pnpm build` all pass.

Live, in the browser pane:

- Run the new selector logic against live home and search pages.
- Check that the card, video ID, thumbnail, and title are found for Shorts.
- Check the options page at desktop and mobile widths.

Manual, by Ryan in Chrome while signed in:

- Load `dist` and follow the new Shorts steps in the README checklist.
- Check the channel Shorts tab and watch history.
