# YouTube Hover Player MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that opens a reusable floating YouTube hover player with custom controls and persisted settings on supported YouTube pages.

**Architecture:** Use a plain Vite + TypeScript build with two content-script entry points: an isolated-world controller for settings, DOM coordination, and overlay lifecycle, plus a main-world bridge that owns the YouTube IFrame API player because the API expects page-global callbacks. Keep selectors, state transitions, overlay rendering, positioning, storage, and options UI in separate focused modules so each part can be tested independently with Vitest and jsdom.

**Tech Stack:** `pnpm`, `vite`, `typescript`, `vitest`, `jsdom`, Chrome MV3, YouTube IFrame Player API

---

## File Structure

### Root build and metadata

- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/package.json`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tsconfig.json`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/vite.config.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/public/manifest.json`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/.gitignore`

### Shared modules

- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/shared/settings.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/shared/storage.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/shared/youtube.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/shared/page-types.ts`

### Content-side modules

- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/content.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/page-bridge.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/bridge-events.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/selectors.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/state-machine.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/positioning.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/overlay.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/styles.css`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/debug.ts`

### Options page

- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/options/index.html`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/options/main.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/options/styles.css`

### Tests

- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/setup/vitest.setup.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/build/manifest.test.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/shared/settings.test.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/shared/storage.test.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/content/selectors.test.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/content/state-machine.test.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/content/positioning.test.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/content/overlay.test.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/content/page-bridge.test.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/content/content.test.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/options/main.test.ts`

## Preflight Notes

- The workspace is not currently a git repository. Initialize git before the first commit step:

```bash
cd /Users/shiang/projects/ribbons-digital/hoverzoom
git init
```

- Use plain Vite configuration and `pnpm` scripts as the source of truth. If `vp` from Vite Plus is available later, it can wrap the same scripts, but do not make the build depend on Vite Plus-specific scaffolding.
- Keep the main-world player bridge separate from the isolated-world controller. Chrome content scripts default to an isolated world, and those scripts cannot rely on page-global variables while the YouTube IFrame API requires the page-level `onYouTubeIframeAPIReady` callback.

### Task 0: Bootstrap the Toolchain

**Files:**
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/package.json`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tsconfig.json`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/vite.config.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/.gitignore`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/public/manifest.json`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/options/index.html`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/options/main.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/content.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/page-bridge.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/setup/vitest.setup.ts`
- Test: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/build/manifest.test.ts`

- [ ] **Step 1: Create the package manifest and install the build/test harness**

```json
{
  "name": "youtube-hover-player",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "check": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/chrome": "^0.1.24",
    "@types/node": "^24.0.0",
    "jsdom": "^26.0.0",
    "typescript": "^5.8.0",
    "vite": "^7.0.0",
    "vitest": "^3.0.0"
  }
}
```

Run:

```bash
cd /Users/shiang/projects/ribbons-digital/hoverzoom
pnpm install
```

Expected: install succeeds and `node_modules/` plus `pnpm-lock.yaml` are created.

- [ ] **Step 2: Add the base TypeScript and Vite config**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "types": ["chrome", "node", "vitest/globals"],
    "strict": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

```ts
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        options: resolve(__dirname, 'src/options/index.html'),
        content: resolve(__dirname, 'src/content/content.ts'),
        pageBridge: resolve(__dirname, 'src/content/page-bridge.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup/vitest.setup.ts'],
  },
});
```

```gitignore
node_modules
dist
.DS_Store
```

- [ ] **Step 3: Add the initial manifest and placeholder entries**

```json
{
  "manifest_version": 3,
  "name": "YouTube Hover Player",
  "version": "0.1.0",
  "description": "Floating hover mini-player for YouTube thumbnails.",
  "permissions": ["storage"],
  "host_permissions": ["https://www.youtube.com/*"],
  "content_scripts": [
    {
      "matches": ["https://www.youtube.com/*"],
      "js": ["assets/pageBridge.js"],
      "run_at": "document_idle",
      "world": "MAIN"
    },
    {
      "matches": ["https://www.youtube.com/*"],
      "js": ["assets/content.js"],
      "run_at": "document_idle"
    }
  ],
  "options_page": "options.html"
}
```

```ts
// src/content/content.ts
export {};
```

```ts
// src/content/page-bridge.ts
export {};
```

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>YouTube Hover Player</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts
// src/options/main.ts
document.querySelector<HTMLDivElement>('#app')!.textContent = 'YouTube Hover Player options';
```

```ts
// tests/setup/vitest.setup.ts
Object.defineProperty(window, 'scrollX', { value: 0, writable: true });
Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
```

- [ ] **Step 4: Write and run the smoke test**

```ts
import { describe, expect, it } from 'vitest';
import manifest from '../../public/manifest.json';

describe('manifest scaffold', () => {
  it('registers separate main-world and isolated-world content scripts', () => {
    expect(manifest.content_scripts).toHaveLength(2);
    expect(manifest.content_scripts[0].world).toBe('MAIN');
    expect(manifest.content_scripts[1].js).toContain('assets/content.js');
  });

  it('declares the options page and storage permission', () => {
    expect(manifest.permissions).toContain('storage');
    expect(manifest.options_page).toBe('options.html');
  });
});
```

Run:

```bash
pnpm test -- tests/build/manifest.test.ts
pnpm build
```

Expected: the smoke test passes and `dist/` contains `options.html`, `assets/content.js`, and `assets/pageBridge.js`.

- [ ] **Step 5: Commit the scaffold**

```bash
git add .gitignore package.json pnpm-lock.yaml tsconfig.json vite.config.ts public/manifest.json src tests
git commit -m "chore: scaffold hover player extension"
```

### Task 1: Implement Settings and Page-Type Gates

**Files:**
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/shared/settings.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/shared/page-types.ts`
- Test: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/shared/settings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  clampSettings,
  isPageEnabled,
  type HoverPlayerSettings,
} from '../../src/shared/settings';

describe('settings defaults', () => {
  it('ships with the approved MVP defaults', () => {
    expect(DEFAULT_SETTINGS.hoverDelayMs).toBe(250);
    expect(DEFAULT_SETTINGS.closeDelayMs).toBe(150);
    expect(DEFAULT_SETTINGS.enableOnChannelVideos).toBe(true);
  });

  it('clamps volume and overlay dimensions to sane bounds', () => {
    const clamped = clampSettings({
      ...DEFAULT_SETTINGS,
      defaultVolume: 999,
      overlayWidth: 200,
      overlayHeight: 900,
    });

    expect(clamped.defaultVolume).toBe(100);
    expect(clamped.overlayWidth).toBe(320);
    expect(clamped.overlayHeight).toBe(360);
  });

  it('maps page-type flags correctly', () => {
    const disabledSearch: HoverPlayerSettings = {
      ...DEFAULT_SETTINGS,
      enableOnSearch: false,
    };

    expect(isPageEnabled('home', disabledSearch)).toBe(true);
    expect(isPageEnabled('search', disabledSearch)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- tests/shared/settings.test.ts
```

Expected: FAIL with module-not-found errors for `src/shared/settings.ts`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/shared/page-types.ts
export type SupportedPageType =
  | 'home'
  | 'search'
  | 'subscriptions'
  | 'watchSidebar'
  | 'channelVideos'
  | 'other';
```

```ts
// src/shared/settings.ts
import type { SupportedPageType } from './page-types';

export type HoverPlayerSettings = {
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

export const DEFAULT_SETTINGS: HoverPlayerSettings = {
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

export function clampSettings(settings: HoverPlayerSettings): HoverPlayerSettings {
  return {
    ...settings,
    hoverDelayMs: Math.max(0, settings.hoverDelayMs),
    closeDelayMs: Math.max(0, settings.closeDelayMs),
    defaultVolume: Math.max(0, Math.min(100, settings.defaultVolume)),
    overlayWidth: Math.max(320, Math.min(640, settings.overlayWidth)),
    overlayHeight: Math.max(180, Math.min(360, settings.overlayHeight)),
  };
}

export function isPageEnabled(pageType: SupportedPageType, settings: HoverPlayerSettings): boolean {
  if (!settings.enabled) return false;

  switch (pageType) {
    case 'home':
      return settings.enableOnHome;
    case 'search':
      return settings.enableOnSearch;
    case 'subscriptions':
      return settings.enableOnSubscriptions;
    case 'watchSidebar':
      return settings.enableOnWatchSidebar;
    case 'channelVideos':
      return settings.enableOnChannelVideos;
    default:
      return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- tests/shared/settings.test.ts
pnpm check
```

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/settings.ts src/shared/page-types.ts tests/shared/settings.test.ts
git commit -m "feat: add hover player settings model"
```

### Task 2: Implement Storage Reads, Writes, and Live Preference Persistence

**Files:**
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/shared/storage.ts`
- Test: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/shared/storage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/shared/settings';
import { getSettings, saveSettings, saveLiveAudioState } from '../../src/shared/storage';

describe('storage helpers', () => {
  beforeEach(() => {
    const store = new Map<string, unknown>();
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => Object.fromEntries(store)),
          set: vi.fn(async (value: Record<string, unknown>) => {
            Object.entries(value).forEach(([key, entry]) => store.set(key, entry));
          }),
        },
      },
    } as unknown as typeof chrome;
  });

  it('merges stored values over defaults', async () => {
    await saveSettings({ hoverDelayMs: 500, enableOnSearch: false });
    const settings = await getSettings();

    expect(settings.hoverDelayMs).toBe(500);
    expect(settings.enableOnSearch).toBe(false);
    expect(settings.defaultVolume).toBe(DEFAULT_SETTINGS.defaultVolume);
  });

  it('persists live mute and volume updates only', async () => {
    await saveLiveAudioState({ defaultMuted: false, defaultVolume: 75 });
    const settings = await getSettings();

    expect(settings.defaultMuted).toBe(false);
    expect(settings.defaultVolume).toBe(75);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- tests/shared/storage.test.ts
```

Expected: FAIL because `getSettings`, `saveSettings`, and `saveLiveAudioState` do not exist.

- [ ] **Step 3: Write the minimal implementation**

```ts
import { DEFAULT_SETTINGS, clampSettings, type HoverPlayerSettings } from './settings';

const SETTINGS_KEY = 'settings';

export async function getSettings(): Promise<HoverPlayerSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const stored = (result[SETTINGS_KEY] ?? {}) as Partial<HoverPlayerSettings>;
  return clampSettings({ ...DEFAULT_SETTINGS, ...stored });
}

export async function saveSettings(next: Partial<HoverPlayerSettings>): Promise<HoverPlayerSettings> {
  const merged = clampSettings({ ...(await getSettings()), ...next });
  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
  return merged;
}

export async function saveLiveAudioState(
  next: Pick<HoverPlayerSettings, 'defaultMuted' | 'defaultVolume'>,
): Promise<HoverPlayerSettings> {
  return saveSettings(next);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- tests/shared/storage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/storage.ts tests/shared/storage.test.ts
git commit -m "feat: add storage helpers"
```

### Task 3: Implement YouTube Parsing and Supported Card Selection

**Files:**
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/shared/youtube.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/selectors.ts`
- Test: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/content/selectors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import {
  extractMetadata,
  extractThumbnailRect,
  extractVideoId,
  findVideoCardFromTarget,
  getPageType,
  isSupportedCard,
} from '../../src/content/selectors';

describe('YouTube selectors', () => {
  it('finds a standard rich-grid card from a nested target', () => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer>
        <a id="thumbnail" href="/watch?v=abc12345678">
          <img />
        </a>
        <a id="video-title">Example title</a>
        <ytd-channel-name>Example channel</ytd-channel-name>
      </ytd-rich-item-renderer>
    `;

    const target = document.querySelector('img')!;
    const card = findVideoCardFromTarget(target);

    expect(card?.tagName.toLowerCase()).toBe('ytd-rich-item-renderer');
    expect(isSupportedCard(card!)).toBe(true);
    expect(extractVideoId(card!)).toBe('abc12345678');
    expect(extractMetadata(card!)).toEqual({
      title: 'Example title',
      channel: 'Example channel',
    });
  });

  it('detects page types and ignores shorts links', () => {
    expect(getPageType(new URL('https://www.youtube.com/results?search_query=test'))).toBe('search');
    expect(getPageType(new URL('https://www.youtube.com/feed/subscriptions'))).toBe('subscriptions');
    expect(getPageType(new URL('https://www.youtube.com/shorts/abc12345678'))).toBe('other');
  });

  it('returns null when no watch id is present', () => {
    document.body.innerHTML = `<ytd-rich-item-renderer><a href="/shorts/abc12345678">Short</a></ytd-rich-item-renderer>`;
    const card = document.querySelector('ytd-rich-item-renderer')!;
    expect(extractVideoId(card)).toBeNull();
  });

  it('prefers the thumbnail rect when available', () => {
    document.body.innerHTML = `<ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=abc12345678"></a></ytd-rich-item-renderer>`;
    const thumbnail = document.querySelector('#thumbnail') as HTMLElement;
    thumbnail.getBoundingClientRect = () =>
      ({ top: 10, left: 20, width: 200, height: 112, right: 220, bottom: 122, x: 20, y: 10, toJSON() {} }) as DOMRect;

    const rect = extractThumbnailRect(document.querySelector('ytd-rich-item-renderer')!);
    expect(rect?.width).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- tests/content/selectors.test.ts
```

Expected: FAIL because selector helpers are missing.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/shared/youtube.ts
export function parseVideoId(urlLike: string): string | null {
  const url = new URL(urlLike, 'https://www.youtube.com');
  if (url.pathname.startsWith('/shorts/')) return null;
  const videoId = url.searchParams.get('v');
  return videoId && videoId.length >= 11 ? videoId : null;
}
```

```ts
// src/content/selectors.ts
import type { SupportedPageType } from '../shared/page-types';
import { parseVideoId } from '../shared/youtube';

const CARD_SELECTOR = [
  'ytd-rich-item-renderer',
  'ytd-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-compact-video-renderer',
].join(', ');

export function findVideoCardFromTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(CARD_SELECTOR) : null;
}

export function isSupportedCard(card: HTMLElement): boolean {
  return extractVideoId(card) !== null;
}

export function extractVideoUrl(card: HTMLElement): string | null {
  const link = card.querySelector<HTMLAnchorElement>('a[href*="/watch"]');
  return link?.getAttribute('href') ?? null;
}

export function extractVideoId(card: HTMLElement): string | null {
  const href = extractVideoUrl(card);
  return href ? parseVideoId(href) : null;
}

export function extractMetadata(card: HTMLElement): { title?: string; channel?: string } {
  const title = card.querySelector<HTMLElement>('#video-title')?.textContent?.trim() ?? undefined;
  const channel =
    card.querySelector<HTMLElement>('ytd-channel-name, #channel-name')?.textContent?.trim() ?? undefined;
  return { title, channel };
}

export function extractThumbnailRect(card: HTMLElement): DOMRect | null {
  const anchor = card.querySelector<HTMLElement>('#thumbnail, a[href*="/watch"]');
  return anchor?.getBoundingClientRect() ?? null;
}

export function getPageType(url = new URL(window.location.href)): SupportedPageType {
  if (url.pathname === '/') return 'home';
  if (url.pathname === '/results') return 'search';
  if (url.pathname === '/feed/subscriptions') return 'subscriptions';
  if (url.pathname === '/watch') return 'watchSidebar';
  if (url.pathname.endsWith('/videos')) return 'channelVideos';
  return 'other';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- tests/content/selectors.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/youtube.ts src/content/selectors.ts tests/content/selectors.test.ts
git commit -m "feat: add youtube card selectors"
```

### Task 4: Implement the Hover/Open/Close State Machine

**Files:**
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/state-machine.ts`
- Test: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/content/state-machine.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHoverStateMachine } from '../../src/content/state-machine';

describe('hover state machine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('opens only after the hover delay', () => {
    const events: string[] = [];
    const machine = createHoverStateMachine({
      hoverDelayMs: 250,
      closeDelayMs: 150,
      onOpen: () => events.push('open'),
      onClose: () => events.push('close'),
    });

    machine.pointerEntered('card-a');
    vi.advanceTimersByTime(249);
    expect(events).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(events).toEqual(['open']);
    expect(machine.getSnapshot().mode).toBe('open');
  });

  it('cancels close when the pointer re-enters during grace time', () => {
    const events: string[] = [];
    const machine = createHoverStateMachine({
      hoverDelayMs: 0,
      closeDelayMs: 150,
      onOpen: () => events.push('open'),
      onClose: () => events.push('close'),
    });

    machine.pointerEntered('card-a');
    machine.pointerLeft();
    vi.advanceTimersByTime(100);
    machine.pointerEntered('card-a');
    vi.advanceTimersByTime(100);

    expect(events).toEqual(['open']);
    expect(machine.getSnapshot().mode).toBe('open');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- tests/content/state-machine.test.ts
```

Expected: FAIL because `createHoverStateMachine` does not exist.

- [ ] **Step 3: Write the minimal implementation**

```ts
type HoverMode = 'idle' | 'hover_pending' | 'open' | 'closing';

type StateMachineOptions = {
  hoverDelayMs: number;
  closeDelayMs: number;
  onOpen: (cardId: string) => void;
  onClose: () => void;
};

export function createHoverStateMachine(options: StateMachineOptions) {
  let mode: HoverMode = 'idle';
  let currentCardId: string | null = null;
  let hoverTimer: number | null = null;
  let closeTimer: number | null = null;

  const clearHoverTimer = () => {
    if (hoverTimer !== null) window.clearTimeout(hoverTimer);
    hoverTimer = null;
  };

  const clearCloseTimer = () => {
    if (closeTimer !== null) window.clearTimeout(closeTimer);
    closeTimer = null;
  };

  return {
    pointerEntered(cardId: string) {
      currentCardId = cardId;
      clearCloseTimer();

      if (mode === 'open') return;

      mode = 'hover_pending';
      clearHoverTimer();
      hoverTimer = window.setTimeout(() => {
        mode = 'open';
        options.onOpen(cardId);
      }, options.hoverDelayMs);
    },
    pointerLeft() {
      if (mode === 'hover_pending') {
        clearHoverTimer();
        mode = 'idle';
        currentCardId = null;
        return;
      }

      if (mode === 'open') {
        mode = 'closing';
        clearCloseTimer();
        closeTimer = window.setTimeout(() => {
          mode = 'idle';
          currentCardId = null;
          options.onClose();
        }, options.closeDelayMs);
      }
    },
    forceReset() {
      clearHoverTimer();
      clearCloseTimer();
      currentCardId = null;
      mode = 'idle';
    },
    getSnapshot() {
      return { mode, currentCardId };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- tests/content/state-machine.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/state-machine.ts tests/content/state-machine.test.ts
git commit -m "feat: add hover state machine"
```

### Task 5: Implement Overlay Rendering and Viewport Positioning

**Files:**
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/positioning.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/overlay.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/styles.css`
- Test: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/content/positioning.test.ts`
- Test: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/content/overlay.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { computeOverlayPosition } from '../../src/content/positioning';

describe('overlay positioning', () => {
  it('prefers the right side when there is room', () => {
    const result = computeOverlayPosition({
      sourceRect: { top: 20, left: 20, right: 220, bottom: 132, width: 200, height: 112 },
      overlayWidth: 480,
      overlayHeight: 270,
      viewportWidth: 1280,
      viewportHeight: 800,
      scrollX: 0,
      scrollY: 0,
      gap: 16,
    });

    expect(result.placement).toBe('right');
    expect(result.left).toBe(236);
  });
});
```

```ts
import { describe, expect, it } from 'vitest';
import { createOverlay } from '../../src/content/overlay';

describe('overlay DOM', () => {
  it('mounts one reusable shell with controls and metadata region', () => {
    const overlay = createOverlay();
    overlay.mount();
    overlay.show({
      title: 'Demo title',
      channel: 'Demo channel',
      left: 100,
      top: 200,
      width: 480,
      height: 270,
    });

    expect(document.querySelectorAll('#yhp-overlay')).toHaveLength(1);
    expect(document.querySelector('[data-action="toggle-play"]')).not.toBeNull();
    expect(document.querySelector('.yhp-meta')?.textContent).toContain('Demo title');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm test -- tests/content/positioning.test.ts tests/content/overlay.test.ts
```

Expected: FAIL because the positioning and overlay modules are missing.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/content/positioning.ts
export function computeOverlayPosition({
  sourceRect,
  overlayWidth,
  overlayHeight,
  viewportWidth,
  viewportHeight,
  scrollX,
  scrollY,
  gap,
}: {
  sourceRect: Pick<DOMRect, 'top' | 'left' | 'right' | 'bottom' | 'width' | 'height'>;
  overlayWidth: number;
  overlayHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
  gap: number;
}) {
  const candidates = [
    { placement: 'right', left: sourceRect.right + gap, top: sourceRect.top },
    { placement: 'left', left: sourceRect.left - overlayWidth - gap, top: sourceRect.top },
    { placement: 'above', left: sourceRect.left, top: sourceRect.top - overlayHeight - gap },
    { placement: 'below', left: sourceRect.left, top: sourceRect.bottom + gap },
  ] as const;

  const fit = candidates.find((candidate) => {
    return (
      candidate.left >= 0 &&
      candidate.top >= 0 &&
      candidate.left + overlayWidth <= viewportWidth &&
      candidate.top + overlayHeight <= viewportHeight
    );
  });

  const chosen = fit ?? {
    placement: 'fallback',
    left: Math.max(0, Math.min(sourceRect.left, viewportWidth - overlayWidth)),
    top: Math.max(0, Math.min(sourceRect.top, viewportHeight - overlayHeight)),
  };

  return {
    placement: chosen.placement,
    left: chosen.left + scrollX,
    top: chosen.top + scrollY,
  };
}
```

```ts
// src/content/overlay.ts
import styles from './styles.css?inline';

type OverlayShowArgs = {
  title?: string;
  channel?: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export function createOverlay() {
  let root: HTMLDivElement | null = null;

  const ensure = () => {
    if (root) return root;

    const style = document.createElement('style');
    style.textContent = styles;
    document.head.append(style);

    root = document.createElement('div');
    root.id = 'yhp-overlay';
    root.innerHTML = `
      <div class="yhp-shell">
        <div class="yhp-player-host" id="yhp-player-host"></div>
        <div class="yhp-controls">
          <button type="button" data-action="toggle-play" aria-label="Play or pause preview">Play</button>
          <button type="button" data-action="toggle-mute" aria-label="Mute or unmute preview">Mute</button>
          <input type="range" min="0" max="100" value="35" data-action="volume" aria-label="Volume" />
          <button type="button" data-action="close" aria-label="Close preview">Close</button>
        </div>
        <div class="yhp-meta"></div>
      </div>
    `;
    root.hidden = true;
    document.body.append(root);
    return root;
  };

  return {
    mount() {
      ensure();
    },
    show(args: OverlayShowArgs) {
      const node = ensure();
      node.hidden = false;
      node.style.left = `${args.left}px`;
      node.style.top = `${args.top}px`;
      node.querySelector<HTMLElement>('.yhp-shell')!.style.width = `${args.width}px`;
      node.querySelector<HTMLElement>('.yhp-shell')!.style.height = `${args.height}px`;
      node.querySelector<HTMLElement>('.yhp-meta')!.textContent = [args.title, args.channel].filter(Boolean).join(' • ');
    },
    hide() {
      ensure().hidden = true;
    },
    getElement() {
      return ensure();
    },
  };
}
```

```css
#yhp-overlay {
  position: absolute;
  z-index: 2147483647;
}

.yhp-shell {
  display: grid;
  grid-template-rows: 1fr auto auto;
  background: rgba(16, 16, 16, 0.96);
  color: #fff;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.35);
}

.yhp-player-host {
  aspect-ratio: 16 / 9;
}

.yhp-controls {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
}

.yhp-meta {
  padding: 0 12px 12px;
  font-size: 12px;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm test -- tests/content/positioning.test.ts tests/content/overlay.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/positioning.ts src/content/overlay.ts src/content/styles.css tests/content/positioning.test.ts tests/content/overlay.test.ts
git commit -m "feat: add overlay rendering and positioning"
```

### Task 6: Implement Main-World Player Bridge and Event Contract

**Files:**
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/bridge-events.ts`
- Modify: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/page-bridge.ts`
- Test: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/content/page-bridge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BRIDGE_COMMAND_EVENT, BRIDGE_STATE_EVENT, installPageBridge } from '../../src/content/page-bridge';

describe('page bridge', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div id="yhp-player-host"></div>`;
  });

  it('injects the iframe api script when YT is not already loaded', async () => {
    delete (window as Window & typeof globalThis & { YT?: unknown }).YT;
    installPageBridge();

    window.dispatchEvent(
      new CustomEvent(BRIDGE_COMMAND_EVENT, {
        detail: { type: 'open', videoId: 'abc12345678', muted: true, volume: 35 },
      }),
    );

    expect(document.querySelector('script[src="https://www.youtube.com/iframe_api"]')).not.toBeNull();
  });

  it('creates a player after receiving an open command', async () => {
    const loadVideoById = vi.fn();
    const mute = vi.fn();
    const setVolume = vi.fn();

    (window as Window & typeof globalThis & { YT: unknown }).YT = {
      Player: vi.fn().mockImplementation((_id: string, options: Record<string, unknown>) => {
        queueMicrotask(() => {
          (options.events as Record<string, () => void>).onReady();
        });
        return { loadVideoById, mute, setVolume, pauseVideo: vi.fn(), playVideo: vi.fn(), unMute: vi.fn() };
      }),
    };

    installPageBridge();

    window.dispatchEvent(
      new CustomEvent(BRIDGE_COMMAND_EVENT, {
        detail: { type: 'open', videoId: 'abc12345678', muted: true, volume: 35 },
      }),
    );

    await Promise.resolve();

    expect(window.YT).toBeTruthy();
    expect(loadVideoById).toHaveBeenCalledWith('abc12345678');
    expect(mute).toHaveBeenCalled();
    expect(setVolume).toHaveBeenCalledWith(35);
  });

  it('emits bridge state updates on ready', async () => {
    const handler = vi.fn();
    window.addEventListener(BRIDGE_STATE_EVENT, handler as EventListener);
    (window as Window & typeof globalThis & { YT: unknown }).YT = {
      Player: vi.fn().mockImplementation((_id: string, options: Record<string, unknown>) => {
        queueMicrotask(() => {
          (options.events as Record<string, () => void>).onReady();
        });
        return { loadVideoById: vi.fn(), mute: vi.fn(), setVolume: vi.fn(), pauseVideo: vi.fn(), playVideo: vi.fn(), unMute: vi.fn() };
      }),
    };

    installPageBridge();
    window.dispatchEvent(new CustomEvent(BRIDGE_COMMAND_EVENT, { detail: { type: 'open', videoId: 'abc12345678', muted: true, volume: 35 } }));
    await Promise.resolve();

    expect(handler).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- tests/content/page-bridge.test.ts
```

Expected: FAIL because the bridge event contract is missing.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/content/bridge-events.ts
export const BRIDGE_COMMAND_EVENT = 'yhp:command';
export const BRIDGE_STATE_EVENT = 'yhp:state';

export type BridgeCommand =
  | { type: 'open'; videoId: string; muted: boolean; volume: number }
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'mute' }
  | { type: 'unmute' }
  | { type: 'volume'; value: number };
```

```ts
// src/content/page-bridge.ts
import { BRIDGE_COMMAND_EVENT, BRIDGE_STATE_EVENT, type BridgeCommand } from './bridge-events';

type PlayerLike = {
  loadVideoById(videoId: string): void;
  mute(): void;
  unMute(): void;
  setVolume(value: number): void;
  playVideo(): void;
  pauseVideo(): void;
};

export { BRIDGE_COMMAND_EVENT, BRIDGE_STATE_EVENT };

export function installPageBridge() {
  if ((window as Window & typeof globalThis & { __YHP_BRIDGE_INSTALLED__?: boolean }).__YHP_BRIDGE_INSTALLED__) return;
  (window as Window & typeof globalThis & { __YHP_BRIDGE_INSTALLED__?: boolean }).__YHP_BRIDGE_INSTALLED__ = true;
  let player: PlayerLike | null = null;
  let apiPromise: Promise<{ Player: new (...args: unknown[]) => PlayerLike }> | null = null;

  const ensureYouTubeApi = () => {
    const existing = (window as Window & typeof globalThis & { YT?: { Player: new (...args: unknown[]) => PlayerLike } }).YT;
    if (existing?.Player) return Promise.resolve(existing);
    if (apiPromise) return apiPromise;

    apiPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      const previous = (window as Window & typeof globalThis & { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady;
      (window as Window & typeof globalThis & { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve((window as Window & typeof globalThis & { YT: { Player: new (...args: unknown[]) => PlayerLike } }).YT);
      };
      document.head.append(script);
    });

    return apiPromise;
  };

  window.addEventListener(BRIDGE_COMMAND_EVENT, async (event: Event) => {
    const detail = (event as CustomEvent<BridgeCommand>).detail;

    if (detail.type === 'open') {
      const hostId = 'yhp-player-host';
      const YT = await ensureYouTubeApi();

      if (!player) {
        player = new YT.Player(hostId, {
          events: {
            onReady: () => {
              window.dispatchEvent(new CustomEvent(BRIDGE_STATE_EVENT, { detail: { type: 'ready' } }));
            },
          },
        } as unknown as Record<string, unknown>);
      }

      player.loadVideoById(detail.videoId);
      detail.muted ? player.mute() : player.unMute();
      player.setVolume(detail.volume);
      return;
    }

    if (!player) return;
    if (detail.type === 'play') player.playVideo();
    if (detail.type === 'pause') player.pauseVideo();
    if (detail.type === 'mute') player.mute();
    if (detail.type === 'unmute') player.unMute();
    if (detail.type === 'volume') player.setVolume(detail.value);
  });
}

installPageBridge();
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- tests/content/page-bridge.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/bridge-events.ts src/content/page-bridge.ts tests/content/page-bridge.test.ts
git commit -m "feat: add youtube player bridge"
```

### Task 7: Implement Content Orchestration, Route Cleanup, and Live Controls

**Files:**
- Modify: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/content.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/debug.ts`
- Test: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/content/content.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bootstrapContentScript } from '../../src/content/content';

describe('content script orchestration', () => {
  const testSettings = {
    hoverDelayMs: 250,
    closeDelayMs: 150,
    defaultMuted: true,
    defaultVolume: 35,
    overlayWidth: 480,
    overlayHeight: 270,
    showMetadata: true,
    enabled: true,
    enableOnHome: true,
    enableOnSearch: true,
    enableOnSubscriptions: true,
    enableOnWatchSidebar: true,
    enableOnChannelVideos: true,
    debug: false,
  };

  beforeEach(() => {
    document.body.innerHTML = `
      <ytd-rich-item-renderer>
        <a id="thumbnail" href="/watch?v=abc12345678"><img /></a>
        <a id="video-title">Demo title</a>
      </ytd-rich-item-renderer>
    `;
  });

  it('opens after hover delay and dispatches an open command', async () => {
    vi.useFakeTimers();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    bootstrapContentScript(testSettings);

    document.querySelector('img')!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    vi.advanceTimersByTime(250);

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'yhp:command' }));
  });

  it('closes on escape when focus is not editable', () => {
    bootstrapContentScript(testSettings);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('#yhp-overlay')?.hasAttribute('hidden')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- tests/content/content.test.ts
```

Expected: FAIL because `bootstrapContentScript` and the runtime wiring do not exist.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/content/debug.ts
export function debugLog(enabled: boolean, ...args: unknown[]) {
  if (enabled) console.debug('[yhp]', ...args);
}
```

```ts
// src/content/content.ts
import { BRIDGE_COMMAND_EVENT } from './bridge-events';
import { debugLog } from './debug';
import { createOverlay } from './overlay';
import { computeOverlayPosition } from './positioning';
import { findVideoCardFromTarget, extractMetadata, extractThumbnailRect, extractVideoId, getPageType } from './selectors';
import { createHoverStateMachine } from './state-machine';
import { isPageEnabled, type HoverPlayerSettings } from '../shared/settings';
import { getSettings, saveLiveAudioState } from '../shared/storage';

export function bootstrapContentScript(settings: HoverPlayerSettings) {
  let runtimeSettings = { ...settings };
  const overlay = createOverlay();
  overlay.mount();

  const machine = createHoverStateMachine({
    hoverDelayMs: runtimeSettings.hoverDelayMs,
    closeDelayMs: runtimeSettings.closeDelayMs,
    onOpen: (cardId) => {
      const card = document.querySelector<HTMLElement>(`[data-yhp-card-id="${cardId}"]`);
      if (!card) return;
      const rect = extractThumbnailRect(card) ?? card.getBoundingClientRect();
      const position = computeOverlayPosition({
        sourceRect: rect,
        overlayWidth: runtimeSettings.overlayWidth,
        overlayHeight: runtimeSettings.overlayHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        gap: 16,
      });
      const videoId = extractVideoId(card);
      if (!videoId) return;
      const metadata = extractMetadata(card);
      overlay.show({ ...metadata, ...position, width: runtimeSettings.overlayWidth, height: runtimeSettings.overlayHeight });
      window.dispatchEvent(
        new CustomEvent(BRIDGE_COMMAND_EVENT, {
          detail: { type: 'open', videoId, muted: runtimeSettings.defaultMuted, volume: runtimeSettings.defaultVolume },
        }),
      );
    },
    onClose: () => {
      overlay.hide();
      window.dispatchEvent(new CustomEvent(BRIDGE_COMMAND_EVENT, { detail: { type: 'pause' } }));
    },
  });

  document.addEventListener('pointerover', (event) => {
    if (!isPageEnabled(getPageType(), runtimeSettings)) return;
    const card = findVideoCardFromTarget(event.target);
    if (!card) return;
    if (!card.dataset.yhpCardId) card.dataset.yhpCardId = crypto.randomUUID();
    debugLog(runtimeSettings.debug, 'pointerover', card.dataset.yhpCardId);
    machine.pointerEntered(card.dataset.yhpCardId);
  });

  document.addEventListener('pointerout', () => {
    machine.pointerLeft();
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement | null;
    const isEditable = target?.matches('input, textarea, [contenteditable="true"]');
    if (event.key === 'Escape' && !isEditable) {
      overlay.hide();
      machine.forceReset();
    }
  });

  overlay.getElement().addEventListener('input', (event) => {
    const slider = event.target as HTMLInputElement;
    if (slider.dataset.action !== 'volume') return;
    const value = Number(slider.value);
    window.dispatchEvent(new CustomEvent(BRIDGE_COMMAND_EVENT, { detail: { type: 'volume', value } }));
    void saveLiveAudioState({ defaultMuted: false, defaultVolume: value });
    runtimeSettings = { ...runtimeSettings, defaultMuted: false, defaultVolume: value };
  });
}

if (typeof chrome !== 'undefined' && chrome.storage?.local) {
  void getSettings().then(bootstrapContentScript);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- tests/content/content.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/content.ts src/content/debug.ts tests/content/content.test.ts
git commit -m "feat: wire hover player runtime"
```

### Task 8: Implement the Options Page

**Files:**
- Modify: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/options/main.ts`
- Create: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/options/styles.css`
- Test: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/options/main.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { renderOptionsPage } from '../../src/options/main';

describe('options page', () => {
  it('renders MVP toggles and saves edits', async () => {
    const saveSettings = vi.fn();
    document.body.innerHTML = `<div id="app"></div>`;

    await renderOptionsPage({
      settings: {
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
      },
      saveSettings,
    });

    expect(document.querySelector('input[name="hoverDelayMs"]')).not.toBeNull();
    expect(document.querySelector('input[name="enableOnChannelVideos"]')).not.toBeNull();
    expect(document.querySelector('input[name="showMetadata"]')).not.toBeNull();

    const volume = document.querySelector<HTMLInputElement>('input[name="defaultVolume"]')!;
    volume.value = '55';
    volume.dispatchEvent(new Event('change', { bubbles: true }));

    expect(saveSettings).toHaveBeenCalledWith(expect.objectContaining({ defaultVolume: 55 }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm test -- tests/options/main.test.ts
```

Expected: FAIL because `renderOptionsPage` does not exist.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/options/main.ts
import './styles.css';
import type { HoverPlayerSettings } from '../shared/settings';
import { getSettings, saveSettings } from '../shared/storage';

type RenderOptionsArgs = {
  settings: HoverPlayerSettings;
  saveSettings: (next: Partial<HoverPlayerSettings>) => Promise<unknown> | unknown;
};

export async function renderOptionsPage({ settings, saveSettings }: RenderOptionsArgs) {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) throw new Error('Missing #app container');

  const checkbox = (name: keyof HoverPlayerSettings, label: string) =>
    `<label><input type="checkbox" name="${name}" ${settings[name] ? 'checked' : ''} /> ${label}</label>`;
  const numberInput = (name: keyof HoverPlayerSettings, label: string, min: number, max: number, value: number) =>
    `<label>${label} <input type="number" name="${name}" min="${min}" max="${max}" value="${value}" /></label>`;

  app.innerHTML = `
    <form id="options-form">
      ${checkbox('enabled', 'Extension enabled')}
      ${checkbox('defaultMuted', 'Start muted')}
      ${checkbox('showMetadata', 'Show metadata')}
      ${checkbox('debug', 'Enable debug logs')}
      ${checkbox('enableOnHome', 'Home')}
      ${checkbox('enableOnSearch', 'Search')}
      ${checkbox('enableOnSubscriptions', 'Subscriptions')}
      ${checkbox('enableOnWatchSidebar', 'Watch sidebar')}
      ${checkbox('enableOnChannelVideos', 'Channel videos')}
      ${numberInput('hoverDelayMs', 'Hover delay (ms)', 0, 2000, settings.hoverDelayMs)}
      ${numberInput('closeDelayMs', 'Close delay (ms)', 0, 2000, settings.closeDelayMs)}
      ${numberInput('overlayWidth', 'Overlay width', 320, 640, settings.overlayWidth)}
      ${numberInput('overlayHeight', 'Overlay height', 180, 360, settings.overlayHeight)}
      <label>Volume <input type="range" name="defaultVolume" min="0" max="100" value="${settings.defaultVolume}" /></label>
    </form>
  `;

  app.querySelector('#options-form')!.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement;
    const next =
      target.type === 'checkbox'
        ? { [target.name]: target.checked }
        : { [target.name]: Number(target.value) };
    await saveSettings(next as Partial<HoverPlayerSettings>);
  });
}

if (typeof chrome !== 'undefined' && chrome.storage?.local) {
  void getSettings().then((settings) => renderOptionsPage({ settings, saveSettings }));
}
```

```css
body {
  margin: 0;
  font: 14px/1.4 system-ui, sans-serif;
  background: #f6f4ee;
  color: #221f1a;
}

#app {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 20px 48px;
}

form {
  display: grid;
  gap: 12px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm test -- tests/options/main.test.ts
pnpm build
```

Expected: PASS and a successful build that emits `dist/options.html`.

- [ ] **Step 5: Commit**

```bash
git add src/options/main.ts src/options/styles.css tests/options/main.test.ts
git commit -m "feat: add options page"
```

### Task 9: End-to-End Wiring, Manual QA, and Packaging Sanity Check

**Files:**
- Modify: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/content.ts`
- Modify: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/overlay.ts`
- Modify: `/Users/shiang/projects/ribbons-digital/hoverzoom/src/content/page-bridge.ts`
- Modify: `/Users/shiang/projects/ribbons-digital/hoverzoom/tests/content/content.test.ts`

- [ ] **Step 1: Write the failing integration tests for throttling, overlay re-entry, and route cleanup**

```ts
it('cancels close when the pointer enters the overlay during grace time', () => {
  vi.useFakeTimers();
  bootstrapContentScript(testSettings);
  document.querySelector('img')!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
  vi.advanceTimersByTime(250);

  document.querySelector('ytd-rich-item-renderer')!.dispatchEvent(new PointerEvent('pointerout', { bubbles: true }));
  vi.advanceTimersByTime(100);
  document.querySelector('#yhp-overlay')!.dispatchEvent(new PointerEvent('pointerenter', { bubbles: true }));
  vi.advanceTimersByTime(100);

  expect(document.querySelector('#yhp-overlay')?.hasAttribute('hidden')).toBe(false);
});

it('throttles rapid card switching', () => {
  vi.useFakeTimers();
  document.body.innerHTML = `
    <ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=abc12345678"><img id="first" /></a></ytd-rich-item-renderer>
    <ytd-rich-item-renderer><a id="thumbnail" href="/watch?v=def12345678"><img id="second" /></a></ytd-rich-item-renderer>
  `;
  const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
  bootstrapContentScript(testSettings);

  document.querySelector('#first')!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
  vi.advanceTimersByTime(250);
  document.querySelector('#second')!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
  vi.advanceTimersByTime(100);

  expect(dispatchSpy.mock.calls.filter(([event]) => (event as CustomEvent).type === 'yhp:command')).toHaveLength(1);
});

it('resets cleanly on route changes', () => {
  vi.useFakeTimers();
  bootstrapContentScript(testSettings);
  document.querySelector('img')!.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
  vi.advanceTimersByTime(250);

  window.history.pushState({}, '', '/results?search_query=test');
  window.dispatchEvent(new Event('yhp:locationchange'));

  expect(document.querySelector('#yhp-overlay')?.hasAttribute('hidden')).toBe(true);
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run:

```bash
pnpm test -- tests/content/content.test.ts
```

Expected: FAIL because overlay pointer handling, switch throttling, and route cleanup are not implemented yet.

- [ ] **Step 3: Write the concrete runtime guardrails**

```ts
// In src/content/content.ts add:
let lastSwitchAt = 0;
let currentLocation = window.location.href;

const openCard = (card: HTMLElement) => {
  const now = Date.now();
  if (now - lastSwitchAt < 300) return;
  if (!card.isConnected) return;
  lastSwitchAt = now;
  // existing overlay.show + bridge open dispatch
};

overlay.getElement().addEventListener('pointerenter', () => {
  const activeCardId = machine.getSnapshot().currentCardId;
  if (activeCardId) machine.pointerEntered(activeCardId);
});

overlay.getElement().addEventListener('pointerleave', () => {
  machine.pointerLeft();
});

overlay.getElement().addEventListener('click', async (event) => {
  const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
  if (action === 'close') {
    overlay.hide();
    machine.forceReset();
    window.dispatchEvent(new CustomEvent(BRIDGE_COMMAND_EVENT, { detail: { type: 'pause' } }));
  }
  if (action === 'toggle-play') {
    window.dispatchEvent(new CustomEvent(BRIDGE_COMMAND_EVENT, { detail: { type: 'play' } }));
  }
  if (action === 'toggle-mute') {
    window.dispatchEvent(new CustomEvent(BRIDGE_COMMAND_EVENT, { detail: { type: settings.defaultMuted ? 'unmute' : 'mute' } }));
    await saveLiveAudioState({
      defaultMuted: !settings.defaultMuted,
      defaultVolume: settings.defaultVolume,
    });
    settings = { ...settings, defaultMuted: !settings.defaultMuted };
  }
});

const wrapHistoryMethod = (method: 'pushState' | 'replaceState') => {
  const original = history[method];
  history[method] = function (...args) {
    const result = original.apply(this, args as never);
    window.dispatchEvent(new Event('yhp:locationchange'));
    return result;
  };
};

wrapHistoryMethod('pushState');
wrapHistoryMethod('replaceState');
window.addEventListener('popstate', () => window.dispatchEvent(new Event('yhp:locationchange')));
window.addEventListener('yhp:locationchange', () => {
  if (window.location.href === currentLocation) return;
  currentLocation = window.location.href;
  overlay.hide();
  machine.forceReset();
  window.dispatchEvent(new CustomEvent(BRIDGE_COMMAND_EVENT, { detail: { type: 'pause' } }));
});
```

```ts
// In src/content/overlay.ts add:
show(args: OverlayShowArgs) {
  const node = ensure();
  node.hidden = false;
  node.dataset.visible = 'true';
  // existing position and metadata updates
},
hide() {
  const node = ensure();
  node.hidden = true;
  delete node.dataset.visible;
},
```

- [ ] **Step 4: Run the full automated checks**

Run:

```bash
pnpm test
pnpm check
pnpm build
```

Expected: all tests pass, TypeScript passes, and `dist/` is ready to load as an unpacked extension.

- [ ] **Step 5: Load the extension manually in Chrome**

Run through these checks on `https://www.youtube.com/`:

```text
1. Home feed: hover a standard tile for ~250ms and confirm the overlay opens.
2. Search: hover a result tile and confirm the same overlay is reused.
3. Subscriptions: confirm open and close timing feels stable.
4. Channel Videos: confirm the page-type toggle works.
5. Watch page sidebar: confirm the overlay stays inside the viewport.
6. Press Escape outside inputs: confirm the overlay closes.
7. Drag the volume slider: confirm audio updates and persists across a reload.
8. Rapidly sweep across cards: confirm switch throttling prevents flicker.
9. Open DevTools console: confirm no major runtime errors appear during normal interaction.
```

- [ ] **Step 6: Record the final known limits**

```text
- Shorts remain unsupported.
- Playlist cards remain unsupported.
- Some supported card variants may show no metadata until selector coverage is expanded.
- The player bridge depends on the YouTube IFrame API being available in the page world.
```

- [ ] **Step 7: Commit**

```bash
git add src/content/content.ts src/content/overlay.ts tests/content/content.test.ts
git commit -m "feat: finish hover player mvp"
```
