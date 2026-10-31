# YouTube Hover Player

A Manifest V3 browser extension that opens a floating YouTube watch surface when you hover supported video thumbnails on `youtube.com`.

## What It Does

- Opens a floating player beside supported YouTube video cards
- Uses a real YouTube `/watch` surface instead of the standard embed player
- Resumes the last hovered video if you hover the same card again
- Remembers the mute and volume you set inside a preview for the next preview
- Lets you pin a preview so it stays on screen while you scroll
- Hides YouTube's own inline hover preview so two videos do not play at once
- Can be turned on or off from the extension popup
- Exposes settings for delays, size, audio, metadata, and page support

## Why It Uses `/watch`

The original embed-based approach hit YouTube playback restrictions for some videos.
The current implementation uses a same-site `/watch?v=...` iframe on `youtube.com`, which gives more reliable playback for this project's hover-preview use case.

Because the iframe is same-origin, the extension injects a cleanup stylesheet into the loaded watch page.
The stylesheet hides non-player chrome (masthead, sidebar, comments, and live chat), so the preview shows only the player.
Live chat matters most, because its close button misbehaves inside a constrained iframe.

Tradeoffs:

- Playback is more reliable than `/embed`
- The hover surface is heavier than a lightweight embedded player
- The iframe behaves more like a real YouTube watch page than a custom mini-player
- If you are signed in to YouTube, previewed videos can appear in your watch history and affect your recommendations (see [Watch history](#watch-history))

## Supported Pages

- Home
- Search
- Subscriptions
- Watch page sidebar
- Channel videos

Unsupported or ambiguous card types are ignored safely.
Shorts are not supported.

## Current Interaction Model

- Hover a supported thumbnail for the hover delay (default `400ms`) to open the player
- Moving the pointer between parts of the same card does not restart the delay
- Move off both the tile and popup to close it after the close delay (default `150ms`)
- Hover the same video again to resume from the last playback position, with the audio you left it with
- Hover a different video to replace the current watch surface
- Scrolling closes an unpinned popup immediately and blocks reopen for `200ms`
- Leaving the browser window closes an unpinned popup and cancels pending opens
- Press `Escape` to close the popup, also when focus is inside the player
- Opening another YouTube page closes the popup and stops its video

### Pinning

- Select `Pin` to keep the popup open when the pointer leaves it
- A pinned popup stays at the same place on screen while the page scrolls
- Select `Unpin` to return to normal hover behaviour
- `Close`, `Escape`, and opening another page also close a pinned popup

### Placement

- The popup opens to the right of the thumbnail, then to the left, then above, then below
- A popup beside the thumbnail moves up or down to stay inside the window
- If no side has room (for example in a small window), the popup covers the thumbnail

## Settings

Open the settings from the toolbar popup (`Open settings`) or from the extension's details page.
Changes save automatically and apply to open YouTube tabs right away, without a page reload.
An invalid value shows a message beside its field and is not saved.

| Setting | Default | Allowed values | What it does |
| --- | --- | --- | --- |
| Show previews on YouTube | On | On or off | Turns the extension on or off on all pages. |
| Show title and channel under the preview | On | On or off | Shows the video title and channel name below the player. |
| Wait before a preview opens | `400` ms | `400` to `2000` ms | How long you must hover a thumbnail before the preview opens. |
| Wait before a preview closes | `150` ms | `0` to `2000` ms | How long the preview stays after the pointer leaves the card and the preview. |
| Preview width | `960` px | `320` to `1280` px | Width of the player. |
| Preview height | `540` px | `180` to `720` px | Height of the player, without the controls and metadata row. |
| Start previews muted | On | On or off | Audio state for a new preview. Updates when you mute or unmute inside a preview. |
| Volume | `35` | `0` to `100` | Volume for a new preview. Updates when you change the volume inside a preview. |
| Pages | All on | On or off for each page | Home, Search results, Subscriptions, Watch page sidebar, and Channel videos. |
| Write debug messages | Off | On or off | Writes `[yhp]` messages to the browser console on YouTube pages. |

`Reset to defaults` restores every value in the table.

The toolbar popup includes:

- `Enabled on YouTube` toggle
- `Open settings` button

Settings are stored in `chrome.storage.local`, so they apply to this browser profile only.

### Audio memory

A new preview starts with the saved mute state and volume.
When you mute, unmute, or change the volume inside a preview, the extension saves that as the new default.
When you hover the same video again, it resumes with the audio you left it with.
Browsers can block a preview from starting with sound until you interact with YouTube; YouTube then starts it muted or paused.

### YouTube's own hover preview

While previews are on for the current page, the extension hides YouTube's inline preview (`ytd-video-preview`) and pauses it when a preview opens.
On those pages, this also hides YouTube's inline preview for cards the extension does not support, such as Shorts.
Turn off previews for a page to get YouTube's own preview back on that page.

### Watch history

Each preview loads YouTube's normal watch page with your YouTube cookies.
If you are signed in, YouTube can record a previewed video in your watch history and use it for recommendations, the same as if you opened the video.
The extension cannot stop this.
To avoid it, pause your watch history in your YouTube settings, or use YouTube while signed out.

## Development

Project code (dependency installs, tests, builds, lint) runs only inside a Docker Sandbox, never directly on the host Mac.

### Requirements

- Docker Sandboxes (`sbx`)
- Node.js 22 and `pnpm` 10 inside the sandbox; `corepack` provides the `pnpm` version pinned in `package.json`

### Docker Sandbox

| Item | Value |
| --- | --- |
| Sandbox name | `hoverzoom` |
| Workspace | This checkout, mounted at the same path inside the sandbox |
| Ports | None (the extension has no dev server) |

Create the sandbox once from the repository root:

```bash
sbx create --name hoverzoom --skills off shell "$PWD"
```

Run project commands in it from the repository root:

```bash
sbx exec --workdir "$PWD" hoverzoom corepack pnpm install --frozen-lockfile
```

```bash
sbx exec --workdir "$PWD" hoverzoom corepack pnpm test
```

`sbx exec` starts a stopped sandbox.
Stop it when you are done:

```bash
sbx stop hoverzoom
```

### Commands

Run each command inside the sandbox with `sbx exec --workdir "$PWD" hoverzoom corepack pnpm <command>`.

| Command | What it does |
| --- | --- |
| `dev` | Rebuilds the extension into `dist` when files change |
| `build` | Builds the extension into `dist` and checks that the content script has no top-level `import` |
| `test` | Runs the Vitest suite |
| `check` | Runs the TypeScript type check |
| `lint` | Runs Oxlint |
| `icons` | Draws the icon PNGs in `public/icons` again |

Notes:

- The extension pages and the content script build separately; `vite.content.config.ts` builds the content script as one standalone file, because MV3 content scripts cannot load shared chunks
- CI (`.github/workflows/ci.yml`) runs lint, type check, tests, and build on every push to `main` and every pull request

## Load The Extension

1. Build the extension in the sandbox with `build`
2. Open `chrome://extensions` or `brave://extensions`
3. Enable Developer mode
4. Click `Load unpacked`
5. Select this project's `dist` directory
6. Refresh YouTube after each rebuild or click `Update` on the extensions page

## Manual Test Checklist

The automated tests use a simulated browser and simplified YouTube markup.
YouTube changes its page structure often, so check these steps on real YouTube before a release, while you are signed out and while you are signed in.

1. On Home, Search, Subscriptions, a channel's Videos tab, and a watch page sidebar, hover a video card: the preview opens beside it after the hover delay.
2. Move the pointer around inside the card before the preview opens: it opens once, after the hover delay.
3. Move the pointer from the card into the preview, then out of both: it closes after the close delay.
4. Hover the same card again: the video resumes where it stopped.
5. Unmute the preview and change its volume, then hover another card: the new preview uses the same audio. The settings page shows the new values.
6. Select `Pin`, then scroll the page: the preview stays in place. Select `Unpin`, then move away: it closes.
7. Click inside the player, then press `Escape`: the preview closes.
8. Click a video title on the page while a preview plays: the preview closes and its sound stops.
9. Hover a card: YouTube's own inline preview does not play.
10. Change the hover delay and the preview size in the settings: an open YouTube tab uses the new values without a reload.
11. Enter `50` as the hover delay: the settings page shows an error and does not save it.
12. Hover a card near the right edge and near the bottom of the window: the preview stays fully on screen and does not cover the thumbnail when there is room beside it.

## Project Structure

```text
src/content/   Content script runtime, hover logic, overlay, player control
src/options/   Options page
src/popup/     Toolbar popup
src/shared/    Shared settings and storage helpers
public/        Manifest and icons
tests/         Vitest coverage
scripts/       Build verification and icon generation
```

## Architecture Notes

- `src/content/content.ts`
  Coordinates hover state, page events, scroll/window guards, YouTube navigation events, and overlay lifecycle.
- `src/content/player-controller.ts`
  Owns the `/watch` iframe, applies and saves audio, and preserves only the last hovered video session.
- `src/content/state-machine.ts`
  Encapsulates `idle`, hover-pending, open, and closing transitions.
- `src/content/selectors.ts`
  Keeps YouTube DOM assumptions in one place.
- `src/shared/settings.ts`
  Defines defaults, allowed ranges, and validation for stored settings; the content script, popup, and options page all use it.

YouTube is a single-page app.
Its own `history.pushState` calls run in the page's script context, which a content script cannot patch, so the content script listens for YouTube's `yt-navigate-start` and `yt-navigate-finish` events instead.

## Testing

The project uses Vitest with JSDOM for unit and integration-style coverage around:

- content orchestration
- selector behavior
- overlay behavior and placement
- player controller behavior, including audio
- options and popup UI, including invalid input and failed saves
- manifest/build guards

## Limitations

- This is intentionally scoped to `youtube.com`
- The hover player is not a universal substitute for YouTube's native preview behavior
- Shorts, playlists, and full watch-surface customization are out of scope for the current MVP

## Related Docs

- [Design spec](./docs/superpowers/specs/2026-04-10-youtube-hover-player-design.md)
- [MVP plan](./docs/superpowers/plans/2026-04-10-youtube-hover-player-mvp.md)
