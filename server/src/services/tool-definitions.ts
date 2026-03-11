// ── OpenRouter / OpenAI-compatible tool definitions for Chef AI ─────

const RECIPE_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const, description: "Recipe title" },
    description: {
      type: "string" as const,
      description: "Short description of the dish",
    },
    ingredients: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          name: { type: "string" as const },
          amount: { type: "string" as const },
          unit: { type: "string" as const },
        },
        required: ["name", "amount", "unit"],
        additionalProperties: false,
      },
      description: "List of ingredients with amounts and units",
    },
    instructions: {
      type: "array" as const,
      items: { type: "string" as const },
      description: "Ordered list of cooking steps",
    },
    nutrition: {
      type: "object" as const,
      properties: {
        calories: { type: "number" as const },
        protein: { type: "number" as const },
        carbs: { type: "number" as const },
        fat: { type: "number" as const },
        fiber: { type: "number" as const },
      },
      required: ["calories", "protein", "carbs", "fat", "fiber"],
      additionalProperties: false,
      description: "Nutritional info per serving",
    },
    cuisine: { type: "string" as const, description: "Cuisine type (e.g. Italian, Mexican)" },
    cookTimeMin: {
      type: "integer" as const,
      description: "Total cook time in minutes",
    },
    servings: {
      type: "integer" as const,
      description: "Number of servings",
    },
  },
  required: [
    "title",
    "description",
    "ingredients",
    "instructions",
    "nutrition",
    "cuisine",
    "cookTimeMin",
    "servings",
  ],
  additionalProperties: false,
} as const;

export const CHEF_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "save_recipe",
      description:
        "Save a complete recipe with ingredients, instructions, and nutrition info. Call this whenever you have a recipe to share with the user.",
      parameters: RECIPE_SCHEMA,
    },
  },
  {
    type: "function" as const,
    function: {
      name: "save_meal_plan",
      description:
        "Save a meal plan consisting of multiple meals across days of the week. Call this when the user asks for a meal plan.",
      parameters: {
        type: "object" as const,
        properties: {
          name: {
            type: "string" as const,
            description: "Name for the meal plan",
          },
          meals: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                day: {
                  type: "integer" as const,
                  description: "Day of the week: 0 = Monday through 6 = Sunday",
                  minimum: 0,
                  maximum: 6,
                },
                mealType: {
                  type: "string" as const,
                  enum: ["breakfast", "lunch", "dinner", "snack"],
                },
                recipe: RECIPE_SCHEMA,
              },
              required: ["day", "mealType", "recipe"],
              additionalProperties: false,
            },
            description: "List of meals in the plan",
          },
        },
        required: ["name", "meals"],
        additionalProperties: false,
      },
    },
  },
] as const;
