# YouTube Hover Player MVP Design

**Date:** 2026-04-10
**Status:** Draft for review
**Project Type:** Greenfield Chrome extension

## Goal

Build a Chrome Manifest V3 extension that lets users preview supported YouTube videos in a floating hover player without leaving the current page. The first release should be stable, lightweight, and intentionally narrow.

## Scope

### Included in MVP

- Chrome MV3 extension scaffold
- TypeScript-based project with bundling
- Content script on `https://www.youtube.com/*`
- Delegated hover detection for supported YouTube video cards
- One reusable floating overlay
- One reusable YouTube IFrame player instance
- Custom controls for play/pause, mute/unmute, volume, and close
- Persistent settings via `chrome.storage.local`
- Options page built with vanilla DOM
- Page support for Home, Search, Subscriptions, Channel Videos, and watch-page related sidebar
- Escape-to-close behavior when focus is not in an editable field
- Lightweight debug logging gate for development

### Explicitly Out of Scope

- Shorts
- Playlists
- YouTube native hover-preview modification
- Queueing or multi-player mode
- Watch Later integration
- Cross-tab sync
- Publish-ready Chrome Web Store polish

## Technical Direction

### Build and Runtime

- Use TypeScript.
- Prefer `pnpm` for package management.
- Prefer Vite Plus if it fits cleanly for MV3 extension scaffolding; otherwise use plain Vite with an explicit MV3 structure.
- Keep runtime UI logic in vanilla DOM rather than adding a framework.

### Runtime Architecture

The extension should be composed of focused modules:

- `content` entry module
  - boots settings
  - determines page support
  - installs delegated pointer and keyboard listeners
  - coordinates route-change cleanup
- `selectors` module
  - identifies supported video cards
  - extracts video ID, URL, metadata, thumbnail rect, and page type
  - contains all YouTube DOM assumptions in one place
- `state machine` module
  - owns the `idle`, `hover_pending`, `open`, and `closing` states
  - owns hover/open/close timers and transition guards
- `overlay` module
  - mounts one reusable overlay node
  - renders the player host and control bar
  - updates metadata if enabled
- `positioning` module
  - computes placement from the thumbnail rect when available, otherwise the card rect
  - prefers right, then left, then above, then below, then nearest-fit clamp
- `player controller` module
  - lazy-loads and wraps the YouTube IFrame Player API
  - reuses one player instance
  - supports video switching, mute, volume, play, and pause
- `storage` module
  - reads merged defaults from `chrome.storage.local`
  - writes settings and live preference changes
- `options` module
  - renders the settings page in vanilla DOM
  - reads and writes settings through the shared storage layer

## Supported Page Types

The MVP should support these page types:

- Home
- Search
- Subscriptions
- Channel Videos
- Watch-page related videos sidebar

Unsupported or ambiguous card types should be ignored safely. The extension should not attempt broad compatibility with every YouTube card variant in MVP.

## Interaction Model

### Core Flow

1. The user moves the pointer over a supported video tile.
2. The content script resolves the nearest supported card using event delegation.
3. After `hoverDelayMs`, if the same card is still valid, the overlay opens near that card.
4. The hovered video loads into the reusable IFrame player and autoplay starts muted by default.
5. The user can play/pause, mute/unmute, adjust volume, or close the overlay.
6. If the pointer leaves both the source card and the overlay, the close timer starts.
7. If the pointer re-enters before the close timer expires, the overlay remains open.
8. If the timer expires, the overlay closes and playback pauses.

### State Machine

The runtime state machine should use these states:

- `idle`
- `hover_pending`
- `open`
- `closing`

Key transitions:

- `idle -> hover_pending` when pointer enters a supported tile
- `hover_pending -> open` when the hover delay completes and the card is still valid
- `hover_pending -> idle` when the pointer leaves before open
- `open -> closing` when the pointer leaves both card and overlay
- `closing -> open` when the pointer re-enters the card or overlay before timeout
- `closing -> idle` when the close delay completes
- `any -> idle` when navigation occurs, the source card disappears, player initialization fails, or the user explicitly closes the overlay

### Switching Behavior

When the user moves from one supported card to another while the overlay is already open:

- keep the same overlay node
- keep the same player instance
- apply the normal hover delay to the new card
- switch videos in place if the new hover survives the delay
- throttle switching to avoid excessive reload churn during rapid card-skimming

Recommended guardrails:

- hover delay default: `250ms`
- close delay default: `150ms`
- video switch throttle: about `250-300ms`
- ignore instant reopen on the same card shortly after close

## Overlay Design

### Layout

- Default size: `480x270`
- Maintain 16:9 player area
- Minimum size: `320x180`
- Maximum size: approximately `640x360`
- Use a dark surface, rounded corners, clipped overflow, shadow, and a subtle open/close transition
- Keep controls always visible in MVP to reduce UI complexity

### Controls

The control bar should contain:

- play/pause
- mute/unmute
- volume slider
- close button

Metadata is optional in MVP. If `showMetadata` is enabled and durable extraction is available, show a minimal title and channel strip. Metadata must not block the first working release.

### Positioning

Placement should prefer:

1. right of source card
2. left of source card
3. above source card
4. below source card
5. nearest-fit clamped placement

The overlay should stay fully inside the viewport and recompute on resize and scroll while open. Scrolling should not close the overlay by itself unless the source card becomes invalid or detached.

## Player Behavior

- Use the YouTube IFrame Player API.
- Lazy-load the API only when needed.
- Create one player instance and reuse it when switching videos.
- Autoplay muted by default.
- On open, apply stored mute and volume preferences.
- On close, pause playback rather than fully tearing down the player.
- If the API or player fails to initialize, close safely and reset to `idle`.

## Settings Model

The MVP settings should include:

```ts
type HoverPlayerSettings = {
  enabled: boolean;
  hoverDelayMs: number;
  closeDelayMs: number;
  defaultMuted: boolean;
  defaultVolume: number;
  overlayWidth: number;
  overlayHeight: number;
  showMetadata: boolean;
  enableOnHome: boolean;
  enableOnSearch: boolean;
  enableOnSubscriptions: boolean;
  enableOnWatchSidebar: boolean;
  enableOnChannelVideos: boolean;
  debug: boolean;
};
```

Recommended defaults:

```ts
const DEFAULT_SETTINGS: HoverPlayerSettings = {
  enabled: true,
  hoverDelayMs: 250,
  closeDelayMs: 150,
  defaultMuted: true,
  defaultVolume: 35,
  overlayWidth: 480,
  overlayHeight: 270,
  showMetadata: true,
  enableOnHome: true,
  enableOnSearch: true,
  enableOnSubscriptions: true,
  enableOnWatchSidebar: true,
  enableOnChannelVideos: true,
  debug: false,
};
```

Live user interactions with mute and volume controls should persist immediately to `chrome.storage.local` so new overlays open with the last-used audio preferences.

## DOM and Selector Strategy

- Use delegated pointer handling from the document level rather than per-card listeners.
- Resolve candidate cards using stable structural patterns such as watch links, thumbnail anchors, and nearby tile containers.
- Avoid generated class names where possible.
- Prefer thumbnail-level bounding boxes for positioning.
- Fall back to the card bounding box if a thumbnail rect cannot be derived.
- Ignore tiles that do not yield a valid YouTube video ID.

Because YouTube behaves like a single-page app:

- close the overlay on route changes
- invalidate stale card references
- use lightweight observation or URL change detection rather than full rescans

## Error Handling

Fallback behavior should always be “close safely and do nothing.”

Explicit edge cases to handle:

- hovered card disappears before open
- card does not contain a valid video ID
- player API fails to load
- user rapidly sweeps across many cards
- route changes while the overlay is open
- overlay placement would clip outside the viewport
- unsupported card types appear on supported pages

## Accessibility

- Buttons need accessible labels
- Escape closes the overlay unless focus is in an editable field
- Controls should have comfortable hit targets
- Contrast should remain legible over YouTube backgrounds

## Verification Expectations

Functional MVP is complete when the extension:

- opens on standard supported cards after the configured hover delay
- plays the hovered video muted without navigation
- supports play/pause, mute/unmute, and volume
- closes after the configured leave delay
- maintains only one overlay and one active player
- remains fully visible within the viewport
- persists settings through reload using `chrome.storage.local`
- avoids major console errors in normal use

## Delivery Priorities

Priority order for implementation:

1. scaffold and build pipeline
2. settings/storage layer
3. selector and page-type detection
4. state machine and delegated events
5. overlay rendering and positioning
6. player controller integration
7. options page
8. manual verification on supported YouTube surfaces

## Open Constraints

- The current workspace is empty and is not a git repository.
- The instruction reference `RTK.md` was not found under the workspace.
- Design documentation can be written locally now, but commit-based workflow steps depend on initializing or attaching this directory to a git repository.
