// ── User types ──────────────────────────────────────────────────────

export type DietaryPreferences = {
  vegetarian?: boolean;
  vegan?: boolean;
  glutenFree?: boolean;
  dairyFree?: boolean;
  keto?: boolean;
  paleo?: boolean;
  allergies: string[];
  cuisinePreferences: string[];
  cookingSkill?: "beginner" | "intermediate" | "advanced";
};

export type User = {
  id: number;
  email: string;
  name: string;
  dietaryPreferences: DietaryPreferences | null;
  createdAt: number;
};

// ── Recipe types ────────────────────────────────────────────────────

export type Ingredient = {
  name: string;
  amount: string;
  unit: string;
};

export type Nutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type Recipe = {
  id?: number;
  title: string;
  description: string;
  ingredients: Ingredient[];
  instructions: string[];
  nutrition: Nutrition;
  cuisine: string;
  cookTimeMin: number;
  servings: number;
  imageUrl?: string;
};

// ── Chat types ──────────────────────────────────────────────────────

export type ChatMessage = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  recipeData?: Recipe | null;
  createdAt?: number;
};

export type Conversation = {
  id: number;
  title: string;
  createdAt: number;
};

// ── Meal plan types ─────────────────────────────────────────────────

export type MealPlanItem = {
  day: number; // 0-6 (Mon-Sun)
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  recipeId?: number;
  recipe?: Recipe;
};

export type MealPlan = {
  id?: number;
  name: string;
  startDate: string;
  meals: MealPlanItem[];
  createdAt?: number;
};

// ── API types ───────────────────────────────────────────────────────

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};
