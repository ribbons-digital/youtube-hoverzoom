import styles from "./styles.css?inline";

type OverlayContentArgs = {
  title?: string;
  channel?: string;
  width: number;
  height: number;
};

export function createOverlay() {
  let root: HTMLDivElement | null = null;
  let styleNode: HTMLStyleElement | null = null;

  const ensure = () => {
    if (!styleNode) {
      styleNode = document.createElement("style");
      styleNode.id = "yhp-style";
      styleNode.textContent = styles;
      document.head.append(styleNode);
    }

    if (root) return root;

    root = document.createElement("div");
    root.id = "yhp-overlay";
    root.hidden = true;
    root.innerHTML = `
      <div class="yhp-shell">
        <div class="yhp-player-host" id="yhp-player-host"></div>
        <div class="yhp-controls">
          <button type="button" data-action="pin-toggle" aria-label="Pin preview" aria-pressed="false">Pin</button>
          <button type="button" data-action="close" aria-label="Close preview">Close</button>
        </div>
        <div class="yhp-meta"></div>
      </div>
    `;
    document.body.append(root);
    return root;
  };

  return {
    mount() {
      ensure();
    },

    // Shows the overlay with its content and returns its full rendered height,
    // so the caller can position it with the real size of the controls and metadata.
    show(args: OverlayContentArgs) {
      const node = ensure();
      node.hidden = false;
      node.dataset.visible = "true";

      const shell = node.querySelector<HTMLElement>(".yhp-shell");
      const playerHost = node.querySelector<HTMLElement>(".yhp-player-host");
      const meta = node.querySelector<HTMLElement>(".yhp-meta");
      if (shell) {
        shell.style.width = `${args.width}px`;
      }
      if (playerHost) {
        playerHost.style.height = `${args.height}px`;
      }
      if (meta) {
        const text = [args.title, args.channel].filter(Boolean).join(" • ");
        meta.textContent = text;
        meta.hidden = !text;
      }

      return node.getBoundingClientRect().height || args.height;
    },

    // Page coordinates while floating; viewport coordinates while pinned.
    setPosition(left: number, top: number) {
      const node = ensure();
      node.style.left = `${left}px`;
      node.style.top = `${top}px`;
    },

    hide() {
      const node = ensure();
      node.hidden = true;
      delete node.dataset.visible;
    },

    // A pinned overlay is fixed to the viewport, so it stays on screen while
    // the page scrolls. Unpinning puts it back into page coordinates.
    setPinned(pinned: boolean) {
      const node = ensure();
      const wasPinned = node.dataset.pinned === "true";
      if (pinned !== wasPinned && !node.hidden) {
        const rect = node.getBoundingClientRect();
        const left = pinned ? rect.left : rect.left + window.scrollX;
        const top = pinned ? rect.top : rect.top + window.scrollY;
        node.style.left = `${left}px`;
        node.style.top = `${top}px`;
      }

      if (pinned) {
        node.dataset.pinned = "true";
      } else {
        delete node.dataset.pinned;
      }

      const btn = node.querySelector<HTMLElement>('[data-action="pin-toggle"]');
      if (!btn) return;
      btn.textContent = pinned ? "Unpin" : "Pin";
      btn.setAttribute("aria-label", pinned ? "Unpin preview" : "Pin preview");
      btn.setAttribute("aria-pressed", String(pinned));
      btn.classList.toggle("pinned", pinned);
    },

    getElement() {
      return ensure();
    }
  };
}
