import { resolve } from "node:path";
import { defineConfig } from "vite";

// Builds the extension pages. The content script is built separately by
// vite.content.config.ts, because MV3 content scripts cannot load shared chunks.
// Neither build empties dist; the package scripts clean it first.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: {
        options: resolve(__dirname, "src/options/index.html"),
        popup: resolve(__dirname, "src/popup/index.html")
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup/vitest.setup.ts"]
  }
});
