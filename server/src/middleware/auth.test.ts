import { test, expect, describe, beforeAll } from "bun:test";
import { Hono } from "hono";
import jwt from "jsonwebtoken";

/**
 * The auth middleware is tightly coupled to the DB (imports db + users at
 * module level). Rather than mocking Drizzle internals, we test the
 * middleware's HTTP-level contract by mounting it in a real Hono app that
 * talks to the actual SQLite DB. This doubles as a lightweight integration
 * test for the auth layer.
 *
 * We also directly test signToken since it's a pure function.
 */

// Import triggers DB init (creates ./data/ dir + opens SQLite) — acceptable in test
import { signToken, authMiddleware, type AuthEnv } from "./auth.ts";
import { db, users } from "../db/index.ts";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

// ── Test app setup ──────────────────────────────────────────────────

let testUserId: number;
let validToken: string;

const app = new Hono<AuthEnv>();

app.use("/protected/*", authMiddleware);
app.get("/protected/me", (c) => {
  return c.json({ userId: c.get("userId") });
});

async function request(path: string, headers: Record<string, string> = {}) {
  const req = new Request(`http://localhost${path}`, { headers });
  return app.fetch(req);
}

beforeAll(async () => {
  // Ensure a test user exists
  const email = `auth-test-${Date.now()}@test.local`;
  const hash = await bcrypt.hash("testpass", 10);

  const result = db
    .insert(users)
    .values({ email, name: "Auth Test User", passwordHash: hash })
    .returning({ id: users.id })
    .get();

  testUserId = result.id;
  validToken = signToken(testUserId);
});

// ── signToken ───────────────────────────────────────────────────────

describe("signToken", () => {
  test("returns a string JWT", () => {
    const token = signToken(42);
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // header.payload.signature
  });

  test("encodes userId in the payload", () => {
    const token = signToken(99);
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.userId).toBe(99);
  });

  test("sets expiration", () => {
    const token = signToken(1);
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded.exp).toBeDefined();
    expect(typeof decoded.exp).toBe("number");
  });
});

// ── authMiddleware ──────────────────────────────────────────────────

describe("authMiddleware", () => {
  test("rejects requests with no Authorization header", async () => {
    const res = await request("/protected/me");
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/authorization/i);
  });

  test("rejects requests with malformed Authorization header (no Bearer prefix)", async () => {
    const res = await request("/protected/me", {
      Authorization: `Token ${validToken}`,
    });
    expect(res.status).toBe(401);
  });

  test("rejects requests with an invalid JWT", async () => {
    const res = await request("/protected/me", {
      Authorization: "Bearer this.is.garbage",
    });
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toMatch(/invalid|expired/i);
  });

  test("rejects requests with a JWT signed by a different secret", async () => {
    const badToken = jwt.sign({ userId: testUserId }, "wrong-secret", {
      expiresIn: "1h",
    });
    const res = await request("/protected/me", {
      Authorization: `Bearer ${badToken}`,
    });
    expect(res.status).toBe(401);
  });

  test("rejects requests with a JWT for a non-existent user", async () => {
    const ghostToken = signToken(999999);
    const res = await request("/protected/me", {
      Authorization: `Bearer ${ghostToken}`,
    });
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });

  test("passes with a valid JWT and sets userId", async () => {
    const res = await request("/protected/me", {
      Authorization: `Bearer ${validToken}`,
    });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.userId).toBe(testUserId);
  });
});
