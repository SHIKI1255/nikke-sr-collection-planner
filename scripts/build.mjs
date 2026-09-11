import { createHash } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { assembleHtml } from "./assemble.mjs";
import { loadProject, projectRoot } from "./project-config.mjs";

const distDir = resolve(projectRoot, "dist");
if (dirname(distDir) !== projectRoot || basename(distDir) !== "dist") throw new Error("Invalid build output directory");
const { site, rules } = await loadProject();
const checksumLines = [];
// Assemble and validate everything before replacing the previous local build.
const artifacts = await Promise.all(site.languages.map(async (build) => {
  const html = await assembleHtml(projectRoot, build.locale);
  for (const token of [rules.verified_at, "window.__SR_CALCULATOR__", site.creator.display_name]) {
    if (!html.includes(token)) throw new Error(`Missing build token: ${token}`);
  }
  if (build.locale === "en" && /\p{Script=Han}/u.test(html)) throw new Error("English source HTML contains Chinese interface text");
  return { ...build, html };
}));
await rm(distDir, { recursive: true, force: true });
await mkdir(resolve(distDir, "downloads"), { recursive: true });
for (const artifact of artifacts) {
  const pagePath = resolve(distDir, artifact.pagePath);
  const checksum = createHash("sha256").update(artifact.html).digest("hex");
  await mkdir(dirname(pagePath), { recursive: true });
  await writeFile(pagePath, artifact.html, "utf8");
  await writeFile(resolve(distDir, "downloads", artifact.offlineName), artifact.html, "utf8");
  checksumLines.push(`${checksum}  ${artifact.offlineName}`);
  console.log(`Built ${artifact.locale}: ${Buffer.byteLength(artifact.html)} bytes, SHA256 ${checksum}`);
}
await writeFile(resolve(distDir, ".nojekyll"), "", "utf8");
await writeFile(resolve(distDir, "downloads/SHA256SUMS.txt"), `${checksumLines.join("\n")}\n`, "utf8");
