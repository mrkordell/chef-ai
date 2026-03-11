import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "node:fs";
import * as schema from "./schema.ts";

// ---------------------------------------------------------------------------
// Ensure the data directory exists before opening the database file
// ---------------------------------------------------------------------------

const DB_PATH = process.env.DATABASE_PATH ?? "./data/chef.db";

// Derive the parent directory from the DB path so volume mounts work correctly
import { dirname } from "node:path";
mkdirSync(dirname(DB_PATH), { recursive: true });

// ---------------------------------------------------------------------------
// Raw SQLite connection (Bun's native driver)
// ---------------------------------------------------------------------------

export const sqlite = new Database(DB_PATH);

// WAL mode gives better concurrent read performance and avoids writer-starvation
sqlite.exec("PRAGMA journal_mode = WAL;");

// ---------------------------------------------------------------------------
// Drizzle ORM instance — pass the schema so relational queries work
// ---------------------------------------------------------------------------

export const db = drizzle(sqlite, { schema });

// ---------------------------------------------------------------------------
// Re-export schema tables & types for convenience
// ---------------------------------------------------------------------------

export {
  users,
  conversations,
  messages,
  recipes,
  mealPlans,
} from "./schema.ts";

export type {
  User,
  NewUser,
  Conversation,
  NewConversation,
  Message,
  NewMessage,
  Recipe,
  NewRecipe,
  MealPlan,
  NewMealPlan,
} from "./schema.ts";
