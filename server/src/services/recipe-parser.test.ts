import { test, expect, describe } from "bun:test";
import { parseRecipes, parseMealPlan, stripRecipeBlocks } from "./recipe-parser.ts";

// ── Fixtures ────────────────────────────────────────────────────────

const VALID_RECIPE = {
  title: "Spaghetti Carbonara",
  description: "Classic Roman pasta dish with eggs, cheese, and pancetta.",
  ingredients: [
    { name: "spaghetti", amount: "400", unit: "g" },
    { name: "pancetta", amount: "200", unit: "g" },
    { name: "eggs", amount: "4", unit: "whole" },
    { name: "parmesan", amount: "100", unit: "g" },
  ],
  instructions: [
    "Boil pasta in salted water.",
    "Fry pancetta until crispy.",
    "Mix eggs and parmesan.",
    "Combine everything off heat.",
  ],
  nutrition: { calories: 650, protein: 30, carbs: 70, fat: 25, fiber: 3 },
  cuisine: "Italian",
  cookTimeMin: 25,
  servings: 4,
};

const VALID_RECIPE_WITH_IMAGE = {
  ...VALID_RECIPE,
  title: "Fancy Carbonara",
  imageUrl: "https://example.com/carbonara.jpg",
};

function fence(tag: string, json: unknown): string {
  return "```" + tag + "\n" + JSON.stringify(json, null, 2) + "\n```";
}

// ── parseRecipes ────────────────────────────────────────────────────

describe("parseRecipes", () => {
  test("parses a valid recipe from a code fence", () => {
    const content = `Here's a recipe for you!\n\n${fence("recipe", VALID_RECIPE)}\n\nEnjoy!`;
    const recipes = parseRecipes(content);

    expect(recipes).toHaveLength(1);
    expect(recipes[0]!.title).toBe("Spaghetti Carbonara");
    expect(recipes[0]!.ingredients).toHaveLength(4);
    expect(recipes[0]!.nutrition.calories).toBe(650);
    expect(recipes[0]!.servings).toBe(4);
  });

  test("preserves optional imageUrl when present", () => {
    const content = fence("recipe", VALID_RECIPE_WITH_IMAGE);
    const recipes = parseRecipes(content);

    expect(recipes).toHaveLength(1);
    expect(recipes[0]!.imageUrl).toBe("https://example.com/carbonara.jpg");
  });

  test("omits imageUrl when not present", () => {
    const content = fence("recipe", VALID_RECIPE);
    const recipes = parseRecipes(content);

    expect(recipes).toHaveLength(1);
    expect(recipes[0]!.imageUrl).toBeUndefined();
  });

  test("parses multiple recipes from one message", () => {
    const recipe2 = { ...VALID_RECIPE, title: "Aglio e Olio" };
    const content = `Two recipes:\n\n${fence("recipe", VALID_RECIPE)}\n\nAnd another:\n\n${fence("recipe", recipe2)}`;
    const recipes = parseRecipes(content);

    expect(recipes).toHaveLength(2);
    expect(recipes[0]!.title).toBe("Spaghetti Carbonara");
    expect(recipes[1]!.title).toBe("Aglio e Olio");
  });

  test("returns empty array for messages with no recipe fences", () => {
    expect(parseRecipes("Just a normal chat message.")).toEqual([]);
    expect(parseRecipes("")).toEqual([]);
    expect(parseRecipes("```js\nconsole.log('hi')\n```")).toEqual([]);
  });

  test("handles malformed JSON inside a recipe fence gracefully", () => {
    const content = "```recipe\n{ this is not valid json }\n```";
    expect(parseRecipes(content)).toEqual([]);
  });

  test("skips recipe fences with valid JSON but missing required fields", () => {
    const incomplete = { title: "Oops", description: "Missing most fields" };
    const content = fence("recipe", incomplete);
    expect(parseRecipes(content)).toEqual([]);
  });

  test("skips recipe with wrong ingredient shape", () => {
    const bad = { ...VALID_RECIPE, ingredients: [{ name: "salt" }] }; // missing amount, unit
    const content = fence("recipe", bad);
    expect(parseRecipes(content)).toEqual([]);
  });

  test("skips recipe with wrong nutrition shape", () => {
    const bad = { ...VALID_RECIPE, nutrition: { calories: "lots" } };
    const content = fence("recipe", bad);
    expect(parseRecipes(content)).toEqual([]);
  });

  test("skips recipe with non-string instructions", () => {
    const bad = { ...VALID_RECIPE, instructions: [1, 2, 3] };
    const content = fence("recipe", bad);
    expect(parseRecipes(content)).toEqual([]);
  });

  test("handles empty fence body", () => {
    const content = "```recipe\n\n```";
    expect(parseRecipes(content)).toEqual([]);
  });

  test("handles fence without closing backticks (incomplete fence)", () => {
    const content = "```recipe\n" + JSON.stringify(VALID_RECIPE);
    expect(parseRecipes(content)).toEqual([]);
  });

  test("can be called multiple times (regex lastIndex reset)", () => {
    const content = fence("recipe", VALID_RECIPE);
    // Call twice to verify the global regex resets properly
    expect(parseRecipes(content)).toHaveLength(1);
    expect(parseRecipes(content)).toHaveLength(1);
  });

  test("ignores mealplan fences", () => {
    const content = fence("mealplan", [{ day: 0, mealType: "breakfast" }]);
    expect(parseRecipes(content)).toEqual([]);
  });
});

// ── parseMealPlan ───────────────────────────────────────────────────

describe("parseMealPlan", () => {
  const VALID_MEAL_ITEMS = [
    { day: 0, mealType: "breakfast" },
    { day: 0, mealType: "lunch" },
    { day: 1, mealType: "dinner" },
  ];

  test("parses a valid meal plan from an array", () => {
    const content = fence("mealplan", VALID_MEAL_ITEMS);
    const plan = parseMealPlan(content);

    expect(plan).not.toBeNull();
    expect(plan).toHaveLength(3);
    expect(plan![0]!.day).toBe(0);
    expect(plan![0]!.mealType).toBe("breakfast");
  });

  test("parses a meal plan wrapped in { meals: [...] }", () => {
    const content = fence("mealplan", { meals: VALID_MEAL_ITEMS });
    const plan = parseMealPlan(content);

    expect(plan).not.toBeNull();
    expect(plan).toHaveLength(3);
  });

  test("attaches inline recipe when valid", () => {
    const itemWithRecipe = { day: 2, mealType: "dinner", recipe: VALID_RECIPE };
    const content = fence("mealplan", [itemWithRecipe]);
    const plan = parseMealPlan(content);

    expect(plan).not.toBeNull();
    expect(plan).toHaveLength(1);
    expect(plan![0]!.recipe).toBeDefined();
    expect(plan![0]!.recipe!.title).toBe("Spaghetti Carbonara");
  });

  test("omits inline recipe when it's invalid", () => {
    const itemWithBadRecipe = { day: 2, mealType: "dinner", recipe: { title: "Incomplete" } };
    const content = fence("mealplan", [itemWithBadRecipe]);
    const plan = parseMealPlan(content);

    expect(plan).not.toBeNull();
    expect(plan).toHaveLength(1);
    expect(plan![0]!.recipe).toBeUndefined();
  });

  test("returns null for messages with no mealplan fence", () => {
    expect(parseMealPlan("Just chatting.")).toBeNull();
    expect(parseMealPlan("")).toBeNull();
  });

  test("returns null for malformed JSON in mealplan fence", () => {
    const content = "```mealplan\n{ not json }\n```";
    expect(parseMealPlan(content)).toBeNull();
  });

  test("returns null when JSON is valid but not an array or { meals }", () => {
    const content = fence("mealplan", { something: "else" });
    expect(parseMealPlan(content)).toBeNull();
  });

  test("returns null when all items fail validation", () => {
    const badItems = [
      { day: 7, mealType: "breakfast" }, // day out of range
      { day: 0, mealType: "brunch" },    // invalid meal type
      { day: -1, mealType: "lunch" },    // negative day
    ];
    const content = fence("mealplan", badItems);
    expect(parseMealPlan(content)).toBeNull();
  });

  test("filters out invalid items but keeps valid ones", () => {
    const mixed = [
      { day: 0, mealType: "breakfast" },  // valid
      { day: 8, mealType: "lunch" },      // invalid day
      { day: 3, mealType: "snack" },      // valid
    ];
    const content = fence("mealplan", mixed);
    const plan = parseMealPlan(content);

    expect(plan).not.toBeNull();
    expect(plan).toHaveLength(2);
    expect(plan![0]!.mealType).toBe("breakfast");
    expect(plan![1]!.mealType).toBe("snack");
  });

  test("validates all four meal types", () => {
    const allTypes = [
      { day: 0, mealType: "breakfast" },
      { day: 1, mealType: "lunch" },
      { day: 2, mealType: "dinner" },
      { day: 3, mealType: "snack" },
    ];
    const content = fence("mealplan", allTypes);
    const plan = parseMealPlan(content);

    expect(plan).toHaveLength(4);
  });

  test("validates day boundary values (0 and 6)", () => {
    const items = [
      { day: 0, mealType: "breakfast" },
      { day: 6, mealType: "dinner" },
    ];
    const content = fence("mealplan", items);
    const plan = parseMealPlan(content);

    expect(plan).toHaveLength(2);
  });

  test("handles empty mealplan fence", () => {
    const content = "```mealplan\n\n```";
    expect(parseMealPlan(content)).toBeNull();
  });

  test("can be called multiple times (regex lastIndex reset)", () => {
    const content = fence("mealplan", VALID_MEAL_ITEMS);
    expect(parseMealPlan(content)).toHaveLength(3);
    expect(parseMealPlan(content)).toHaveLength(3);
  });
});

// ── stripRecipeBlocks ───────────────────────────────────────────────

describe("stripRecipeBlocks", () => {
  test("removes recipe fences but keeps surrounding text", () => {
    const content = `Here's your recipe!\n\n${fence("recipe", VALID_RECIPE)}\n\nHope you like it!`;
    const stripped = stripRecipeBlocks(content);

    expect(stripped).not.toContain("```recipe");
    expect(stripped).not.toContain("Spaghetti Carbonara");
    expect(stripped).toContain("Here's your recipe!");
    expect(stripped).toContain("Hope you like it!");
  });

  test("removes mealplan fences but keeps surrounding text", () => {
    const items = [{ day: 0, mealType: "breakfast" }];
    const content = `Your meal plan:\n\n${fence("mealplan", items)}\n\nEnjoy your week!`;
    const stripped = stripRecipeBlocks(content);

    expect(stripped).not.toContain("```mealplan");
    expect(stripped).toContain("Your meal plan:");
    expect(stripped).toContain("Enjoy your week!");
  });

  test("removes both recipe and mealplan fences from same message", () => {
    const items = [{ day: 0, mealType: "lunch" }];
    const content = `Intro\n\n${fence("recipe", VALID_RECIPE)}\n\nMiddle\n\n${fence("mealplan", items)}\n\nOutro`;
    const stripped = stripRecipeBlocks(content);

    expect(stripped).not.toContain("```recipe");
    expect(stripped).not.toContain("```mealplan");
    expect(stripped).toContain("Intro");
    expect(stripped).toContain("Middle");
    expect(stripped).toContain("Outro");
  });

  test("collapses excessive newlines to double newlines", () => {
    const content = `Before\n\n${fence("recipe", VALID_RECIPE)}\n\n\n\nAfter`;
    const stripped = stripRecipeBlocks(content);

    // Should not have more than 2 consecutive newlines
    expect(stripped).not.toMatch(/\n{3,}/);
  });

  test("trims leading and trailing whitespace", () => {
    const content = `  \n\n${fence("recipe", VALID_RECIPE)}\n\n  `;
    const stripped = stripRecipeBlocks(content);

    expect(stripped).toBe("");
  });

  test("returns original text when no fences present", () => {
    const content = "Just a normal message with no code fences.";
    expect(stripRecipeBlocks(content)).toBe(content);
  });

  test("leaves non-recipe code fences untouched", () => {
    const content = "Check this code:\n\n```js\nconsole.log('hello');\n```\n\nCool right?";
    expect(stripRecipeBlocks(content)).toBe(content);
  });
});
