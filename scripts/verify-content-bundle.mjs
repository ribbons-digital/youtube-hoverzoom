import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// MV3 content scripts cannot load ES modules, so each must be one standalone file.
const bundles = ["dist/assets/content.js", "dist/assets/page-bridge.js"];

for (const bundle of bundles) {
  const bundlePath = resolve(bundle);
  const source = await readFile(bundlePath, "utf8");

  if (/^\s*import\s/m.test(source)) {
    console.error(`Content bundle ${bundlePath} contains an ESM import. MV3 content scripts must remain standalone.`);
    process.exit(1);
  }
}
