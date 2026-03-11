import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const unixNow = () => Math.floor(Date.now() / 1000);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  /** JSON string — `{ vegetarian: boolean, allergies: string[], cuisinePreferences: string[] }` */
  dietaryPreferences: text("dietary_preferences"),
  createdAt: integer("created_at").notNull().$defaultFn(unixNow),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export const conversations = sqliteTable("conversations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull().default("New Chat"),
  createdAt: integer("created_at").notNull().$defaultFn(unixNow),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id),
  /** "user" | "assistant" */
  role: text("role").notNull(),
  content: text("content").notNull(),
  /** Nullable JSON string — structured recipe data when the AI generates a recipe */
  recipeData: text("recipe_data"),
  /** Nullable JSON string — full array of tool call results (save_recipe, save_meal_plan, etc.) */
  toolCalls: text("tool_calls"),
  createdAt: integer("created_at").notNull().$defaultFn(unixNow),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

// ---------------------------------------------------------------------------
// Recipes (saved / favorited)
// ---------------------------------------------------------------------------

export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  /** JSON array of `{ name: string, amount: string, unit: string }` */
  ingredients: text("ingredients").notNull(),
  /** JSON array of step strings */
  instructions: text("instructions").notNull(),
  /** JSON object `{ calories, protein, carbs, fat, fiber }` */
  nutrition: text("nutrition"),
  cuisine: text("cuisine"),
  cookTimeMin: integer("cook_time_min"),
  servings: integer("servings"),
  imageUrl: text("image_url"),
  sourceMessageId: integer("source_message_id").references(() => messages.id),
  createdAt: integer("created_at").notNull().$defaultFn(unixNow),
});

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;

// ---------------------------------------------------------------------------
// Meal Plans
// ---------------------------------------------------------------------------

export const mealPlans = sqliteTable("meal_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  /** ISO date string, e.g. "2026-03-10" */
  startDate: text("start_date").notNull(),
  /** JSON array of `{ day: number, mealType: "breakfast"|"lunch"|"dinner"|"snack", recipeId: number }` */
  meals: text("meals").notNull(),
  createdAt: integer("created_at").notNull().$defaultFn(unixNow),
});

export type MealPlan = typeof mealPlans.$inferSelect;
export type NewMealPlan = typeof mealPlans.$inferInsert;
