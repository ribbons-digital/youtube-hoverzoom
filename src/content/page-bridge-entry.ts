import { installPageBridge } from "./page-bridge";

declare global {
  interface Window {
    __YHP_PAGE_BRIDGE_INSTALLED__?: boolean;
  }
}

if (window.self === window.top && !window.__YHP_PAGE_BRIDGE_INSTALLED__) {
  window.__YHP_PAGE_BRIDGE_INSTALLED__ = true;
  installPageBridge();
}
