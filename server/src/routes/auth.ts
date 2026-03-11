import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users } from "../db/index.ts";
import type { AuthEnv } from "../middleware/auth.ts";
import { authMiddleware, signToken } from "../middleware/auth.ts";
import type { User as SharedUser, ApiResponse, AuthResponse } from "../../../shared/types.ts";
import type { DietaryPreferences } from "../../../shared/types.ts";

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required").max(100),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip passwordHash and parse dietaryPreferences JSON for the API response. */
function toPublicUser(dbUser: {
  id: number;
  email: string;
  name: string;
  dietaryPreferences: string | null;
  createdAt: number;
  passwordHash: string;
}): SharedUser {
  let prefs: DietaryPreferences | null = null;
  if (dbUser.dietaryPreferences) {
    try {
      prefs = JSON.parse(dbUser.dietaryPreferences) as DietaryPreferences;
    } catch {
      prefs = null;
    }
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    dietaryPreferences: prefs,
    createdAt: dbUser.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const authRoutes = new Hono<AuthEnv>();

// ── POST /register ──────────────────────────────────────────────────

authRoutes.post("/register", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join(", ");
    return c.json<ApiResponse<never>>({ success: false, error: message }, 400);
  }

  const { email, password, name } = parsed.data;

  // Check for existing user
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return c.json<ApiResponse<never>>({ success: false, error: "Email already registered" }, 409);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [inserted] = await db
    .insert(users)
    .values({ email, passwordHash, name })
    .returning();

  if (!inserted) {
    return c.json<ApiResponse<never>>({ success: false, error: "Failed to create user" }, 500);
  }

  const token = signToken(inserted.id);
  const user = toPublicUser(inserted);

  return c.json<ApiResponse<AuthResponse>>({ success: true, data: { token, user } }, 201);
});

// ── POST /login ─────────────────────────────────────────────────────

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join(", ");
    return c.json<ApiResponse<never>>({ success: false, error: message }, 400);
  }

  const { email, password } = parsed.data;

  const [dbUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!dbUser) {
    return c.json<ApiResponse<never>>({ success: false, error: "Invalid email or password" }, 401);
  }

  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    return c.json<ApiResponse<never>>({ success: false, error: "Invalid email or password" }, 401);
  }

  const token = signToken(dbUser.id);
  const user = toPublicUser(dbUser);

  return c.json<ApiResponse<AuthResponse>>({ success: true, data: { token, user } });
});

// ── GET /me ─────────────────────────────────────────────────────────

authRoutes.get("/me", authMiddleware, async (c) => {
  const dbUser = c.get("user");
  const user = toPublicUser(dbUser);

  return c.json<ApiResponse<SharedUser>>({ success: true, data: user });
});
