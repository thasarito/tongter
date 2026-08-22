import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");
const publicLogo = resolve(projectRoot, "public/logo.svg");
const publicFavicon = resolve(projectRoot, "public/favicon.svg");
const indexHtml = resolve(projectRoot, "index.html");
const viewportStyles = resolve(projectRoot, "src/client/viewport.css");
const rootAssetExtensions = new Set([
  ".ai",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

function readRequiredAsset(path: string): string {
  expect(existsSync(path), `${path} should exist`).toBe(true);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

describe("wedding artwork", () => {
  it("keeps served visual assets out of the repository root", () => {
    const looseRootAssets = readdirSync(projectRoot, { withFileTypes: true })
      .filter(
        (entry) =>
          entry.isFile() && rootAssetExtensions.has(extname(entry.name).toLowerCase()),
      )
      .map((entry) => entry.name)
      .sort();

    expect(looseRootAssets).toEqual([]);
  });

  it("ships the supplied outlined logo as a public SVG", () => {
    const logo = readRequiredAsset(publicLogo);

    expect(logo).toMatch(/<path\b/);
    expect(logo).not.toMatch(/<(?:image|text)\b/);
  });

  it("derives the favicon from outlined artwork instead of live text", () => {
    const favicon = readRequiredAsset(publicFavicon);

    expect(favicon).toMatch(/<path\b/);
    expect(favicon).not.toMatch(/<text\b/);
  });

  it("configures iOS Safari for an edge-to-edge olive landing", () => {
    const html = readRequiredAsset(indexHtml);
    const styles = readRequiredAsset(viewportStyles);

    expect(html).toContain("viewport-fit=cover");
    expect(html).toMatch(
      /<meta\s+name="theme-color"\s+content="#9c9d88"\s*\/>/i,
    );
    expect(styles).toMatch(
      /html\s*\{[\s\S]*?background-color:\s*#9c9d88\s*;/,
    );
    expect(styles).toMatch(/#root\s*\{[\s\S]*?min-height:\s*100dvh\s*;/);
  });
});
