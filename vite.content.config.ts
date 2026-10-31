import { resolve } from "node:path";
import { defineConfig } from "vite";

// Builds a content script as one standalone IIFE file, so it can share
// modules with the extension pages without emitting an ESM import.
// The default mode builds the isolated-world content script; `--mode bridge`
// builds the small page-context script that uses YouTube's player API.
const ENTRIES = {
  content: { entry: "src/content/content.ts", file: "assets/content.js" },
  bridge: { entry: "src/content/page-bridge-entry.ts", file: "assets/page-bridge.js" }
};

export default defineConfig(({ mode }) => {
  const target = mode === "bridge" ? ENTRIES.bridge : ENTRIES.content;
  return {
    publicDir: false,
    build: {
      outDir: "dist",
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, target.entry),
        formats: ["iife"],
        name: "YouTubeHoverPlayer",
        fileName: () => target.file
      }
    }
  };
});
