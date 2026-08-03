import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), "utf8"));
}

test("program version stays synchronized across release metadata", async () => {
  const [packageJson, packageLock, manifest, changelog, readme] = await Promise.all([
    readJson("package.json"),
    readJson("package-lock.json"),
    readJson("manifest.json"),
    readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
  ]);

  const version = packageJson.version;
  const latestRelease = changelog.match(/^## \[(\d+\.\d+\.\d+)\] - \d{4}-\d{2}-\d{2}$/m);

  assert.ok(latestRelease, "CHANGELOG must contain a dated stable release");
  assert.equal(packageLock.version, version);
  assert.equal(packageLock.packages[""].version, version);
  assert.equal(manifest.program_version, version);
  assert.equal(latestRelease[1], version);
  assert.ok(readme.includes(`当前程序版本：\`v${version}\``));
});
