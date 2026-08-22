import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");
const publicLogo = resolve(projectRoot, "public/logo.svg");
const publicFavicon = resolve(projectRoot, "public/favicon.svg");
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
});
