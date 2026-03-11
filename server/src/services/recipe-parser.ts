import type {
  Recipe,
  Ingredient,
  Nutrition,
  MealPlanItem,
} from "../../../shared/types.ts";

// ── Validation helpers ──────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isIngredient(value: unknown): value is Ingredient {
  if (!isObject(value)) return false;
  return (
    typeof value.name === "string" &&
    typeof value.amount === "string" &&
    typeof value.unit === "string"
  );
}

function isNutrition(value: unknown): value is Nutrition {
  if (!isObject(value)) return false;
  return (
    typeof value.calories === "number" &&
    typeof value.protein === "number" &&
    typeof value.carbs === "number" &&
    typeof value.fat === "number" &&
    typeof value.fiber === "number"
  );
}

function isValidRecipe(value: unknown): value is Recipe {
  if (!isObject(value)) return false;

  const r = value;
  return (
    typeof r.title === "string" &&
    typeof r.description === "string" &&
    Array.isArray(r.ingredients) &&
    r.ingredients.every(isIngredient) &&
    isStringArray(r.instructions) &&
    isNutrition(r.nutrition) &&
    typeof r.cuisine === "string" &&
    typeof r.cookTimeMin === "number" &&
    typeof r.servings === "number"
  );
}

const VALID_MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack"]);

function isValidMealPlanItem(value: unknown): value is MealPlanItem {
  if (!isObject(value)) return false;

  return (
    typeof value.day === "number" &&
    value.day >= 0 &&
    value.day <= 6 &&
    typeof value.mealType === "string" &&
    VALID_MEAL_TYPES.has(value.mealType)
  );
}

// ── Regex patterns ──────────────────────────────────────────────────

const RECIPE_FENCE_RE = /```recipe\s*\n([\s\S]*?)```/g;
const MEALPLAN_FENCE_RE = /```mealplan\s*\n([\s\S]*?)```/g;
const ALL_FENCES_RE = /```(?:recipe|mealplan)\s*\n[\s\S]*?```/g;

// ── Public functions ────────────────────────────────────────────────

/**
 * Scan AI response content for ```recipe code fences, parse the JSON
 * inside each, validate required fields, and return valid Recipe objects.
 * Never throws — returns an empty array on any failure.
 */
export function parseRecipes(content: string): Recipe[] {
  const recipes: Recipe[] = [];

  // Reset lastIndex since we reuse the regex
  RECIPE_FENCE_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = RECIPE_FENCE_RE.exec(content)) !== null) {
    const jsonStr = match[1];
    if (!jsonStr) continue;

    try {
      const parsed: unknown = JSON.parse(jsonStr.trim());

      if (isValidRecipe(parsed)) {
        recipes.push({
          title: parsed.title,
          description: parsed.description,
          ingredients: parsed.ingredients,
          instructions: parsed.instructions,
          nutrition: parsed.nutrition,
          cuisine: parsed.cuisine,
          cookTimeMin: parsed.cookTimeMin,
          servings: parsed.servings,
          ...(typeof (parsed as Record<string, unknown>).imageUrl === "string"
            ? { imageUrl: (parsed as Record<string, unknown>).imageUrl as string }
            : {}),
        });
      }
    } catch {
      // Malformed JSON — skip this block
    }
  }

  return recipes;
}

/**
 * Scan AI response content for a ```mealplan code fence, parse the JSON,
 * and return the meal plan items. Returns null if no valid plan is found.
 */
export function parseMealPlan(content: string): MealPlanItem[] | null {
  MEALPLAN_FENCE_RE.lastIndex = 0;

  const match = MEALPLAN_FENCE_RE.exec(content);
  if (!match?.[1]) return null;

  try {
    const parsed: unknown = JSON.parse(match[1].trim());

    // The AI may return { meals: [...] } or a raw array
    let items: unknown[];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (isObject(parsed) && Array.isArray(parsed.meals)) {
      items = parsed.meals as unknown[];
    } else {
      return null;
    }

    const validItems: MealPlanItem[] = [];

    for (const item of items) {
      if (!isValidMealPlanItem(item)) continue;

      const mealItem: MealPlanItem = {
        day: item.day,
        mealType: item.mealType,
      };

      // Attach the full recipe if the AI included one inline
      if (isObject(item) && isValidRecipe((item as Record<string, unknown>).recipe)) {
        mealItem.recipe = (item as Record<string, unknown>).recipe as Recipe;
      }

      validItems.push(mealItem);
    }

    return validItems.length > 0 ? validItems : null;
  } catch {
    return null;
  }
}

/**
 * Strip ```recipe and ```mealplan code fences from content, leaving
 * only the conversational text for cleaner display.
 */
export function stripRecipeBlocks(content: string): string {
  return content.replace(ALL_FENCES_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}
