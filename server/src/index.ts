import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth.ts";
import { chatRoutes } from "./routes/chat.ts";
import { recipeRoutes } from "./routes/recipes.ts";
import { mealPlanRoutes } from "./routes/meal-plans.ts";
import { preferencesRoutes } from "./routes/preferences.ts";
import { config } from "./config.ts";
import { db, sqlite } from "./db/index.ts";

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const api = new Hono();

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

api.use("*", cors({ origin: config.CORS_ORIGIN }));

// ---------------------------------------------------------------------------
// Mount route groups
// ---------------------------------------------------------------------------

api.route("/api/auth", authRoutes);
api.route("/api/chat", chatRoutes);
api.route("/api/recipes", recipeRoutes);
api.route("/api/meal-plans", mealPlanRoutes);
api.route("/api/preferences", preferencesRoutes);

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

api.get("/api/health", (c) => {
  try {
    // Verify DB is accessible — a lightweight query against the raw SQLite driver
    sqlite.query("SELECT 1").get();
    return c.json({
      status: "ok",
      timestamp: Date.now(),
      uptime: process.uptime(),
    });
  } catch {
    return c.json({ status: "degraded", error: "database unreachable" }, 503);
  }
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------

api.onError((err, c) => {
  console.error("[API Error]", err);

  const status = "status" in err && typeof err.status === "number" ? err.status : 500;
  const message = err instanceof Error ? err.message : "Internal server error";

  return c.json({ success: false, error: message }, status as 500);
});

// ---------------------------------------------------------------------------
// 404 fallback
// ---------------------------------------------------------------------------

api.notFound((c) => {
  return c.json({ success: false, error: "Not found" }, 404);
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export { api };
