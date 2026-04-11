# YouTube Hover Player

A Manifest V3 browser extension that opens a floating YouTube watch surface when you hover supported video thumbnails on `youtube.com`.

## What It Does

- Opens a floating player beside supported YouTube video cards
- Uses a real YouTube `/watch` surface instead of the standard embed player
- Resumes the last hovered video if you hover the same card again
- Hides immediately while scrolling and waits briefly before reopening
- Can be enabled or disabled from the extension popup
- Exposes settings for delays, size, mute/volume defaults, metadata, and page support

## Why It Uses `/watch`

The original embed-based approach hit YouTube playback restrictions for some videos. The current implementation uses a same-site `/watch?v=...` iframe on `youtube.com`, which gives more reliable playback for this project’s hover-preview use case.

Tradeoffs:

- Playback is more reliable than `/embed`
- The hover surface is heavier than a lightweight embedded player
- The iframe behaves more like a real YouTube watch page than a custom mini-player

## Supported Pages

- Home
- Search
- Subscriptions
- Watch page sidebar
- Channel videos

Unsupported or ambiguous card types are ignored safely.

## Current Interaction Model

- Hover a supported thumbnail for `400ms` to open the player
- Move off both the tile and popup to close it
- Hover the same video again to resume from the last playback position
- Hover a different video to replace the current watch surface
- Scrolling closes the popup immediately and blocks reopen for `200ms`
- Leaving the browser window closes the popup and cancels pending opens

## Settings

The options page currently supports:

- Extension enabled
- Hover delay
- Close delay
- Start muted
- Default volume
- Overlay width
- Overlay height
- Show metadata
- Page-level enable toggles
- Debug logging

The toolbar popup includes:

- `Enabled on YouTube` toggle
- `Open settings` button

## Development

### Requirements

- Node.js
- `pnpm`

### Install

```bash
pnpm install
```

### Commands

```bash
pnpm dev
pnpm build
pnpm test
pnpm check
```

Notes:

- `pnpm dev` runs Vite in watch-build mode for the extension bundle
- `pnpm build` also runs `scripts/verify-content-bundle.mjs` to ensure the MV3 content script does not ship with a top-level `import`

## Load The Extension

1. Run `pnpm build`
2. Open `chrome://extensions` or `brave://extensions`
3. Enable Developer mode
4. Click `Load unpacked`
5. Select this project’s `dist` directory
6. Refresh YouTube after each rebuild or click `Update` on the extensions page

## Project Structure

```text
src/content/   Content script runtime, hover logic, overlay, player control
src/options/   Options page
src/popup/     Toolbar popup
src/shared/    Shared settings and storage helpers
public/        Manifest
tests/         Vitest coverage
scripts/       Build verification helpers
```

## Architecture Notes

- `src/content/content.ts`
  Coordinates hover state, page events, scroll/window guards, and overlay lifecycle.
- `src/content/player-controller.ts`
  Owns the `/watch` iframe and preserves only the last hovered video session.
- `src/content/state-machine.ts`
  Encapsulates `idle`, hover-pending, open, and closing transitions.
- `src/content/selectors.ts`
  Keeps YouTube DOM assumptions in one place.
- `src/shared/settings.ts`
  Defines defaults and clamps persisted settings.

The content runtime is intentionally isolated so the built MV3 content script remains a standalone bundle.

## Testing

The project uses Vitest with JSDOM for unit and integration-style coverage around:

- content orchestration
- selector behavior
- overlay behavior
- player controller behavior
- options and popup UI
- manifest/build guards

## Limitations

- This is intentionally scoped to `youtube.com`
- The hover player is not a universal substitute for YouTube’s native preview behavior
- Shorts, playlists, and full watch-surface customization are out of scope for the current MVP

## Related Docs

- [Design spec](./docs/superpowers/specs/2026-04-10-youtube-hover-player-design.md)
- [MVP plan](./docs/superpowers/plans/2026-04-10-youtube-hover-player-mvp.md)
