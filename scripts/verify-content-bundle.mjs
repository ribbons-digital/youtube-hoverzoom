import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const contentBundlePath = resolve("dist/assets/content.js");
const contentBundle = await readFile(contentBundlePath, "utf8");

if (/^\s*import\s/m.test(contentBundle)) {
  console.error(
    `Content bundle ${contentBundlePath} contains an ESM import. MV3 content scripts must remain standalone.`
  );
  process.exit(1);
}
