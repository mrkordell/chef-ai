import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema.ts";

// ---------------------------------------------------------------------------
// Ensure the data directory exists before opening the database file
// ---------------------------------------------------------------------------

const DB_PATH = process.env.DATABASE_PATH ?? "./data/chef.db";

// Derive the parent directory from the DB path so volume mounts work correctly
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
// Auto-migrate: apply any pending migration files from ./drizzle on startup.
//
// - Uses drizzle-orm's migrate() which is synchronous for bun-sqlite
// - Idempotent: tracks applied migrations in __drizzle_migrations table
// - Fast: skips already-applied migrations (typically <5ms when nothing to do)
// - Fails with an exception if a migration is invalid → server won't start
// ---------------------------------------------------------------------------

const MIGRATIONS_DIR = resolve(import.meta.dir, "../../../drizzle");

export function runMigrations(): void {
  const start = performance.now();
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  const elapsed = (performance.now() - start).toFixed(1);
  console.log(`✅ Database migrations applied (${elapsed}ms)`);
}

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
