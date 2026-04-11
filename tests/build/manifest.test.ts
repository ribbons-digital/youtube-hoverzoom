import { describe, expect, it } from "vitest";
import manifest from "../../public/manifest.json";

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
});
