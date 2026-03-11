import { api } from "./server/src/index.ts";
import { config } from "./server/src/config.ts";
import { sqlite } from "./server/src/db/index.ts";

const isProd = config.NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Production: serve pre-built static files from ./dist
// Development: use Bun HTML imports with HMR
// ---------------------------------------------------------------------------

let server: ReturnType<typeof Bun.serve>;

if (isProd) {
  server = Bun.serve({
    hostname: "0.0.0.0",
    port: config.PORT,

    routes: {
      "/api/*": (req) => api.fetch(req),
    },

    async fetch(req) {
      const url = new URL(req.url);

      // Serve static files from dist/
      const file = Bun.file(`./dist${url.pathname}`);
      if (await file.exists()) {
        return new Response(file);
      }

      // SPA fallback — serve index.html for all non-API, non-file routes
      return new Response(Bun.file("./dist/index.html"), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    },
  });
} else {
  // Dynamic import so the HTML import only triggers in dev mode
  const homepage = (await import("./client/index.html")).default;

  server = Bun.serve({
    hostname: "0.0.0.0",
    port: config.PORT,

    routes: {
      "/": homepage,
      "/api/*": (req) => api.fetch(req),
      "/*": homepage,
    },

    fetch(req) {
      return new Response("Not Found", { status: 404 });
    },

    development: {
      hmr: true,
      console: true,
    },
  });
}

console.log(`Chef AI running at http://${server.hostname}:${server.port}`);

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

const shutdown = () => {
  console.log("Shutting down...");
  server.stop();
  sqlite.close();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
