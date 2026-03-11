import { Hono } from "hono";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, users } from "../db/index.ts";
import type { AuthEnv } from "../middleware/auth.ts";
import { authMiddleware } from "../middleware/auth.ts";
import type { ApiResponse, DietaryPreferences } from "../../../shared/types.ts";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const dietaryPreferencesSchema = z.object({
  vegetarian: z.boolean().optional(),
  vegan: z.boolean().optional(),
  glutenFree: z.boolean().optional(),
  dairyFree: z.boolean().optional(),
  keto: z.boolean().optional(),
  paleo: z.boolean().optional(),
  allergies: z.array(z.string()).default([]),
  cuisinePreferences: z.array(z.string()).default([]),
  cookingSkill: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});

// ---------------------------------------------------------------------------
// Router — all routes require auth
// ---------------------------------------------------------------------------

export const preferencesRoutes = new Hono<AuthEnv>();
preferencesRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET / — get current user's dietary preferences
// ---------------------------------------------------------------------------

preferencesRoutes.get("/", async (c) => {
  const dbUser = c.get("user");

  let preferences: DietaryPreferences | null = null;
  if (dbUser.dietaryPreferences) {
    try {
      preferences = JSON.parse(dbUser.dietaryPreferences) as DietaryPreferences;
    } catch {
      preferences = null;
    }
  }

  return c.json<ApiResponse<DietaryPreferences | null>>({ success: true, data: preferences });
});

// ---------------------------------------------------------------------------
// PUT / — update dietary preferences
// ---------------------------------------------------------------------------

preferencesRoutes.put("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null);

  const parsed = dietaryPreferencesSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join(", ");
    return c.json<ApiResponse<never>>({ success: false, error: message }, 400);
  }

  const preferencesJson = JSON.stringify(parsed.data);

  await db
    .update(users)
    .set({ dietaryPreferences: preferencesJson })
    .where(eq(users.id, userId));

  return c.json<ApiResponse<DietaryPreferences>>({ success: true, data: parsed.data });
});
