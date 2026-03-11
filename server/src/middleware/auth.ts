import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import type { Context, MiddlewareHandler, Env } from "hono";
import { db, users } from "../db/index.ts";
import type { User } from "../db/index.ts";
import { config } from "../config.ts";

// ---------------------------------------------------------------------------
// Hono environment type — lets routes call c.get("user") with full typing
// ---------------------------------------------------------------------------

export type AuthEnv = {
  Variables: {
    user: User;
    userId: number;
  };
} & Env;

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

export function signToken(userId: number): string {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: "7d" });
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

export const authMiddleware: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const header = c.req.header("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return c.json({ success: false, error: "Missing or malformed authorization header" }, 401);
  }

  const token = header.slice(7);

  let payload: { userId: number };
  try {
    payload = jwt.verify(token, config.JWT_SECRET) as { userId: number };
  } catch {
    return c.json({ success: false, error: "Invalid or expired token" }, 401);
  }

  if (typeof payload.userId !== "number") {
    return c.json({ success: false, error: "Invalid token payload" }, 401);
  }

  const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);

  if (!user) {
    return c.json({ success: false, error: "User not found" }, 401);
  }

  c.set("user", user);
  c.set("userId", payload.userId);

  await next();
};
