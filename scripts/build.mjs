import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleHtml } from "./assemble.mjs";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDir, "..");
const distDir = resolve(root, "dist");

if (dirname(distDir) !== root || basename(distDir) !== "dist") {
  throw new Error("Refusing to build outside the repository dist directory.");
}

const html = await assembleHtml(root);
const requiredTokens = [
  "SR收藏品强化规划器",
  "2026-07-29",
  "努力学习的Gabriel",
  "window.__SR_CALCULATOR__",
  'value="6000"',
  'value="2000"',
  'value="1000"',
];

for (const token of requiredTokens) {
  if (!html.includes(token)) {
    throw new Error(`Source HTML is missing required token: ${token}`);
  }
}

await rm(distDir, { recursive: true, force: true });
await mkdir(resolve(distDir, "downloads"), { recursive: true });

const offlineName = "NIKKE_SR.html";
const indexPath = resolve(distDir, "index.html");
const offlinePath = resolve(distDir, "downloads", offlineName);
const checksum = createHash("sha256").update(html, "utf8").digest("hex");

await writeFile(indexPath, html, "utf8");
await writeFile(offlinePath, html, "utf8");
await writeFile(resolve(distDir, ".nojekyll"), "", "utf8");
await writeFile(
  resolve(distDir, "downloads", "SHA256SUMS.txt"),
  `${checksum}  ${offlineName}\n`,
  "utf8",
);

console.log(`Built Pages and standalone artifacts (${checksum.slice(0, 12)}…).`);
