import { Hono } from "hono";
import { eq, and, like } from "drizzle-orm";
import { db, recipes } from "../db/index.ts";
import type { AuthEnv } from "../middleware/auth.ts";
import { authMiddleware } from "../middleware/auth.ts";
import type { ApiResponse, Recipe as SharedRecipe } from "../../../shared/types.ts";
import { safeJsonParse } from "../lib/utils.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse JSON string columns into their typed objects for the API response. */
function toPublicRecipe(row: typeof recipes.$inferSelect): SharedRecipe & { id: number; sourceMessageId: number | null; createdAt: number } {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    ingredients: safeJsonParse(row.ingredients, []),
    instructions: safeJsonParse(row.instructions, []),
    nutrition: safeJsonParse(row.nutrition, null),
    cuisine: row.cuisine ?? "",
    cookTimeMin: row.cookTimeMin ?? 0,
    servings: row.servings ?? 1,
    imageUrl: row.imageUrl ?? undefined,
    sourceMessageId: row.sourceMessageId,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Router — all routes require auth
// ---------------------------------------------------------------------------

export const recipeRoutes = new Hono<AuthEnv>();
recipeRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET / — list user's saved recipes (with optional filters)
// ---------------------------------------------------------------------------

recipeRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const cuisine = c.req.query("cuisine");
  const search = c.req.query("search");

  const conditions = [eq(recipes.userId, userId)];

  if (cuisine) {
    conditions.push(like(recipes.cuisine, `%${cuisine}%`));
  }

  if (search) {
    conditions.push(like(recipes.title, `%${search}%`));
  }

  const rows = await db
    .select()
    .from(recipes)
    .where(and(...conditions));

  const data = rows.map(toPublicRecipe);

  return c.json<ApiResponse<typeof data>>({ success: true, data });
});

// ---------------------------------------------------------------------------
// POST / — save a recipe
// ---------------------------------------------------------------------------

recipeRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null) as {
    title?: string;
    description?: string;
    ingredients?: unknown;
    instructions?: unknown;
    nutrition?: unknown;
    cuisine?: string;
    cookTimeMin?: number;
    servings?: number;
    imageUrl?: string;
    sourceMessageId?: number;
  } | null;

  if (!body?.title || !body.ingredients || !body.instructions) {
    return c.json<ApiResponse<never>>(
      { success: false, error: "title, ingredients, and instructions are required" },
      400,
    );
  }

  const [inserted] = await db
    .insert(recipes)
    .values({
      userId,
      title: body.title,
      description: body.description ?? null,
      ingredients: JSON.stringify(body.ingredients),
      instructions: JSON.stringify(body.instructions),
      nutrition: body.nutrition ? JSON.stringify(body.nutrition) : null,
      cuisine: body.cuisine ?? null,
      cookTimeMin: body.cookTimeMin ?? null,
      servings: body.servings ?? null,
      imageUrl: body.imageUrl ?? null,
      sourceMessageId: body.sourceMessageId ?? null,
    })
    .returning();

  if (!inserted) {
    return c.json<ApiResponse<never>>({ success: false, error: "Failed to save recipe" }, 500);
  }

  return c.json<ApiResponse<ReturnType<typeof toPublicRecipe>>>(
    { success: true, data: toPublicRecipe(inserted) },
    201,
  );
});

// ---------------------------------------------------------------------------
// GET /:id — get a single recipe
// ---------------------------------------------------------------------------

recipeRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const recipeId = Number(c.req.param("id"));

  if (Number.isNaN(recipeId)) {
    return c.json<ApiResponse<never>>({ success: false, error: "Invalid recipe ID" }, 400);
  }

  const [row] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)))
    .limit(1);

  if (!row) {
    return c.json<ApiResponse<never>>({ success: false, error: "Recipe not found" }, 404);
  }

  return c.json<ApiResponse<ReturnType<typeof toPublicRecipe>>>({ success: true, data: toPublicRecipe(row) });
});

// ---------------------------------------------------------------------------
// DELETE /:id — delete a saved recipe
// ---------------------------------------------------------------------------

recipeRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const recipeId = Number(c.req.param("id"));

  if (Number.isNaN(recipeId)) {
    return c.json<ApiResponse<never>>({ success: false, error: "Invalid recipe ID" }, 400);
  }

  const [row] = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)))
    .limit(1);

  if (!row) {
    return c.json<ApiResponse<never>>({ success: false, error: "Recipe not found" }, 404);
  }

  await db.delete(recipes).where(eq(recipes.id, recipeId));

  return c.json<ApiResponse<{ deleted: true }>>({ success: true, data: { deleted: true } });
});
