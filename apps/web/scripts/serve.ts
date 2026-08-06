import { join, normalize } from "node:path";

import server from "../dist/server/server.js";

const port = Number(process.env.PORT ?? 3000);
const clientDir = join(import.meta.dir, "../dist/client");

Bun.serve({
  port,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = normalize(decodeURIComponent(url.pathname));
    if (pathname !== "/" && !pathname.includes("..")) {
      const file = Bun.file(join(clientDir, pathname));
      if (await file.exists()) {
        const immutable = pathname.startsWith("/assets/");
        return new Response(file, {
          headers: immutable
            ? { "cache-control": "public, max-age=31536000, immutable" }
            : { "cache-control": "public, max-age=3600" },
        });
      }
    }
    return server.fetch(req);
  },
});

console.log(`ratat web listening on http://0.0.0.0:${port}`);
