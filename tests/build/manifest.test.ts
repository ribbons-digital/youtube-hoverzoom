import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../../public/manifest.json";
import packageJson from "../../package.json";

describe("manifest scaffold", () => {
  it("registers a single isolated-world content script", () => {
    expect(manifest.content_scripts).toHaveLength(1);
    expect(manifest.content_scripts[0].js).toContain("assets/content.js");
  });

  it("declares the options page and storage permission", () => {
    expect(manifest.permissions).toContain("storage");
    expect(manifest.options_page).toBe("src/options/index.html");
  });

  it("declares a toolbar popup", () => {
    expect(manifest.action?.default_popup).toBe("src/popup/index.html");
  });

  it("points every icon at a file that exists", () => {
    const iconPaths = [...Object.values(manifest.icons), ...Object.values(manifest.action.default_icon)];
    const missing = iconPaths.filter((iconPath) => !existsSync(resolve("public", iconPath)));
    expect(missing).toEqual([]);
  });

  it("keeps the manifest version in step with package.json", () => {
    expect(manifest.version).toBe(packageJson.version);
  });
});
