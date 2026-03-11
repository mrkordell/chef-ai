import { Hono } from "hono";
import { eq, and, inArray } from "drizzle-orm";
import { db, mealPlans, recipes } from "../db/index.ts";
import type { AuthEnv } from "../middleware/auth.ts";
import { authMiddleware } from "../middleware/auth.ts";
import type { ApiResponse, MealPlanItem } from "../../../shared/types.ts";
import { safeJsonParse } from "../lib/utils.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type PublicMealPlan = {
  id: number;
  name: string;
  startDate: string;
  meals: MealPlanItem[];
  createdAt: number;
};

function toPublicMealPlan(row: typeof mealPlans.$inferSelect): PublicMealPlan {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    meals: safeJsonParse<MealPlanItem[]>(row.meals, []),
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Router — all routes require auth
// ---------------------------------------------------------------------------

export const mealPlanRoutes = new Hono<AuthEnv>();
mealPlanRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET / — list user's meal plans
// ---------------------------------------------------------------------------

mealPlanRoutes.get("/", async (c) => {
  const userId = c.get("userId");

  const rows = await db
    .select()
    .from(mealPlans)
    .where(eq(mealPlans.userId, userId))
    .orderBy(mealPlans.createdAt);

  const data = rows.map(toPublicMealPlan);

  return c.json<ApiResponse<typeof data>>({ success: true, data });
});

// ---------------------------------------------------------------------------
// POST / — create a meal plan
// ---------------------------------------------------------------------------

mealPlanRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null) as {
    name?: string;
    startDate?: string;
    meals?: MealPlanItem[];
  } | null;

  if (!body?.name || !body.startDate || !body.meals) {
    return c.json<ApiResponse<never>>(
      { success: false, error: "name, startDate, and meals are required" },
      400,
    );
  }

  const [inserted] = await db
    .insert(mealPlans)
    .values({
      userId,
      name: body.name,
      startDate: body.startDate,
      meals: JSON.stringify(body.meals),
    })
    .returning();

  if (!inserted) {
    return c.json<ApiResponse<never>>({ success: false, error: "Failed to create meal plan" }, 500);
  }

  return c.json<ApiResponse<PublicMealPlan>>(
    { success: true, data: toPublicMealPlan(inserted) },
    201,
  );
});

// ---------------------------------------------------------------------------
// GET /:id — get a single meal plan with full recipe details
// ---------------------------------------------------------------------------

mealPlanRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const planId = Number(c.req.param("id"));

  if (Number.isNaN(planId)) {
    return c.json<ApiResponse<never>>({ success: false, error: "Invalid meal plan ID" }, 400);
  }

  const [row] = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, userId)))
    .limit(1);

  if (!row) {
    return c.json<ApiResponse<never>>({ success: false, error: "Meal plan not found" }, 404);
  }

  const meals = safeJsonParse<MealPlanItem[]>(row.meals, []);

  // Collect all recipeIds referenced in the plan
  const recipeIds = meals
    .map((m) => m.recipeId)
    .filter((id): id is number => typeof id === "number");

  // Fetch full recipe data if there are any referenced recipes
  let recipeMap = new Map<number, Record<string, unknown>>();
  if (recipeIds.length > 0) {
    const recipeRows = await db
      .select()
      .from(recipes)
      .where(inArray(recipes.id, recipeIds));

    recipeMap = new Map(
      recipeRows.map((r) => [
        r.id,
        {
          id: r.id,
          title: r.title,
          description: r.description ?? "",
          ingredients: safeJsonParse(r.ingredients, []),
          instructions: safeJsonParse(r.instructions, []),
          nutrition: safeJsonParse(r.nutrition, null),
          cuisine: r.cuisine ?? "",
          cookTimeMin: r.cookTimeMin ?? 0,
          servings: r.servings ?? 1,
          imageUrl: r.imageUrl ?? undefined,
        },
      ]),
    );
  }

  // Enrich meals with full recipe objects
  const enrichedMeals = meals.map((meal) => ({
    ...meal,
    recipe: meal.recipeId ? (recipeMap.get(meal.recipeId) ?? meal.recipe ?? null) : (meal.recipe ?? null),
  }));

  const data = {
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    meals: enrichedMeals,
    createdAt: row.createdAt,
  };

  return c.json<ApiResponse<typeof data>>({ success: true, data });
});

// ---------------------------------------------------------------------------
// PUT /:id — update a meal plan
// ---------------------------------------------------------------------------

mealPlanRoutes.put("/:id", async (c) => {
  const userId = c.get("userId");
  const planId = Number(c.req.param("id"));

  if (Number.isNaN(planId)) {
    return c.json<ApiResponse<never>>({ success: false, error: "Invalid meal plan ID" }, 400);
  }

  const [existing] = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, userId)))
    .limit(1);

  if (!existing) {
    return c.json<ApiResponse<never>>({ success: false, error: "Meal plan not found" }, 404);
  }

  const body = await c.req.json().catch(() => null) as {
    name?: string;
    startDate?: string;
    meals?: MealPlanItem[];
  } | null;

  if (!body) {
    return c.json<ApiResponse<never>>({ success: false, error: "Request body is required" }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.startDate !== undefined) updates.startDate = body.startDate;
  if (body.meals !== undefined) updates.meals = JSON.stringify(body.meals);

  if (Object.keys(updates).length === 0) {
    return c.json<ApiResponse<never>>({ success: false, error: "No fields to update" }, 400);
  }

  const [updated] = await db
    .update(mealPlans)
    .set(updates)
    .where(eq(mealPlans.id, planId))
    .returning();

  if (!updated) {
    return c.json<ApiResponse<never>>({ success: false, error: "Failed to update meal plan" }, 500);
  }

  return c.json<ApiResponse<PublicMealPlan>>({ success: true, data: toPublicMealPlan(updated) });
});

// ---------------------------------------------------------------------------
// DELETE /:id — delete a meal plan
// ---------------------------------------------------------------------------

mealPlanRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const planId = Number(c.req.param("id"));

  if (Number.isNaN(planId)) {
    return c.json<ApiResponse<never>>({ success: false, error: "Invalid meal plan ID" }, 400);
  }

  const [existing] = await db
    .select()
    .from(mealPlans)
    .where(and(eq(mealPlans.id, planId), eq(mealPlans.userId, userId)))
    .limit(1);

  if (!existing) {
    return c.json<ApiResponse<never>>({ success: false, error: "Meal plan not found" }, 404);
  }

  await db.delete(mealPlans).where(eq(mealPlans.id, planId));

  return c.json<ApiResponse<{ deleted: true }>>({ success: true, data: { deleted: true } });
});
