import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadProject, projectRoot } from "./project-config.mjs";

const { site } = await loadProject();
const routes = new Map([["/downloads/SHA256SUMS.txt", "downloads/SHA256SUMS.txt"]]);
for (const language of site.languages) {
  routes.set(`/${language.pagePath}`, language.pagePath);
  routes.set(`/${language.pagePath.replace(/index\.html$/, "")}`, language.pagePath);
  routes.set(`/downloads/${language.offlineName}`, `downloads/${language.offlineName}`);
}
createServer(async (request, response) => {
  const path = routes.get(new URL(request.url, "http://127.0.0.1").pathname);
  if (!path || !["GET", "HEAD"].includes(request.method)) { response.writeHead(404).end(); return; }
  try {
    const body = await readFile(resolve(projectRoot, "dist", path));
    response.writeHead(200, { "Content-Type": path.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : body);
  } catch { response.writeHead(500).end("Build the site first."); }
}).listen(4173, "127.0.0.1", () => {
  console.log("Local preview: http://127.0.0.1:4173/ (English: /en/). Ctrl+C to stop.");
});
