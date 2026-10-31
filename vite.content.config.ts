import { resolve } from "node:path";
import { defineConfig } from "vite";

// Builds the content script as one standalone IIFE file, so it can share
// modules with the extension pages without emitting an ESM import.
export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist",
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/content/content.ts"),
      formats: ["iife"],
      name: "YouTubeHoverPlayer",
      fileName: () => "assets/content.js"
    }
  }
});
