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

const builds = [
  {
    locale: "zh-CN",
    pagePath: "index.html",
    offlineName: "NIKKE_SR.html",
    requiredTokens: ["SR收藏品强化规划器", "保养工具", "达到目标1次", "制作：", "SHIKI1255"],
  },
  {
    locale: "en",
    pagePath: "en/index.html",
    offlineName: "NIKKE_SR_EN.html",
    requiredTokens: ["SR Collection Item Enhancement Planner", "Maintenance Kit", "Super Success", "Created by", "SHIKI1255"],
  },
];

await rm(distDir, { recursive: true, force: true });
await mkdir(resolve(distDir, "downloads"), { recursive: true });

const checksumLines = [];
const buildSummaries = [];
for (const build of builds) {
  const html = await assembleHtml(root, build.locale);
  const commonTokens = [
    "2026-07-29",
    "window.__SR_CALCULATOR__",
    'value="6000"',
    'value="2000"',
    'value="1000"',
  ];
  for (const token of [...commonTokens, ...build.requiredTokens]) {
    if (!html.includes(token)) {
      throw new Error(`${build.locale} source HTML is missing required token: ${token}`);
    }
  }
  for (const retiredCredit of ["努力学习的Gabriel", "B站UP主"]) {
    if (html.includes(retiredCredit)) {
      throw new Error(`${build.locale} source HTML still contains retired credit: ${retiredCredit}`);
    }
  }
  if (build.locale === "en" && /\p{Script=Han}/u.test(html)) {
    throw new Error("English source HTML contains Chinese interface text.");
  }

  const pagePath = resolve(distDir, build.pagePath);
  const offlinePath = resolve(distDir, "downloads", build.offlineName);
  const checksum = createHash("sha256").update(html, "utf8").digest("hex");
  await mkdir(dirname(pagePath), { recursive: true });
  await writeFile(pagePath, html, "utf8");
  await writeFile(offlinePath, html, "utf8");
  checksumLines.push(`${checksum}  ${build.offlineName}`);
  buildSummaries.push(`${build.locale}:${checksum.slice(0, 12)}`);
}

await writeFile(resolve(distDir, ".nojekyll"), "", "utf8");
await writeFile(
  resolve(distDir, "downloads", "SHA256SUMS.txt"),
  `${checksumLines.join("\n")}\n`,
  "utf8",
);

console.log(`Built bilingual Pages and standalone artifacts (${buildSummaries.join(", ")}).`);
