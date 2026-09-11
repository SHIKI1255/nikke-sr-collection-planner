import { build } from "esbuild";
import { resolve } from "node:path";

/** Tests/build config execute the production TypeScript modules, not copies. */
export async function loadModule(entry) {
  const result = await build({ entryPoints: [resolve(entry)], bundle: true, platform: "node", format: "esm", target: "node20", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}
