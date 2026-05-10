import styles from "./styles.css?inline";

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
          <button type="button" data-action="pin-toggle" aria-label="Pin preview">Pin</button>
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

    show(args: OverlayShowArgs) {
      const node = ensure();
      node.hidden = false;
      node.style.left = `${args.left}px`;
      node.style.top = `${args.top}px`;
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
        meta.textContent = [args.title, args.channel].filter(Boolean).join(" • ");
      }
    },

    hide() {
      const node = ensure();
      node.hidden = true;
      delete node.dataset.visible;
    },

    setPinned(pinned: boolean) {
      const node = ensure();
      const btn = node.querySelector<HTMLElement>('[data-action="pin-toggle"]');
      if (!btn) return;
      btn.textContent = pinned ? "Unpin" : "Pin";
      btn.setAttribute("aria-label", pinned ? "Unpin preview" : "Pin preview");
      btn.classList.toggle("pinned", pinned);
    },

    getElement() {
      return ensure();
    }
  };
}
