import { build } from "esbuild";
import { resolve } from "node:path";

const moduleCache = new Map();

/** Tests/build config execute the production TypeScript modules, not copies. */
export function loadModule(entry) {
  const key = resolve(entry);
  let cached = moduleCache.get(key);
  if (!cached) {
    cached = build({ entryPoints: [key], bundle: true, platform: "node", format: "esm", target: "node20", write: false })
      .then((result) => import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`))
      .catch((error) => {
        moduleCache.delete(key);
        throw error;
      });
    moduleCache.set(key, cached);
  }
  return cached;
}
