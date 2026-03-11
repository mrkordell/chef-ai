import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { db, conversations, messages, users } from "../db/index.ts";
import type { AuthEnv } from "../middleware/auth.ts";
import { authMiddleware } from "../middleware/auth.ts";
import { AIService } from "../services/ai.ts";
import { parseRecipes } from "../services/recipe-parser.ts";
import type { DietaryPreferences, ApiResponse } from "../../../shared/types.ts";
import { safeJsonParse } from "../lib/utils.ts";

// ---------------------------------------------------------------------------
// Router — all routes require auth
// ---------------------------------------------------------------------------

export const chatRoutes = new Hono<AuthEnv>();
chatRoutes.use("*", authMiddleware);

// ---------------------------------------------------------------------------
// GET /conversations — list user's conversations (most recent first)
// ---------------------------------------------------------------------------

chatRoutes.get("/conversations", async (c) => {
  const userId = c.get("userId");

  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.createdAt));

  return c.json<ApiResponse<typeof rows>>({ success: true, data: rows });
});

// ---------------------------------------------------------------------------
// POST /conversations — create a new conversation
// ---------------------------------------------------------------------------

chatRoutes.post("/conversations", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({})) as { title?: string };

  const [created] = await db
    .insert(conversations)
    .values({ userId, title: body.title ?? "New Chat" })
    .returning();

  if (!created) {
    return c.json<ApiResponse<never>>({ success: false, error: "Failed to create conversation" }, 500);
  }

  return c.json<ApiResponse<typeof created>>({ success: true, data: created }, 201);
});

// ---------------------------------------------------------------------------
// GET /conversations/:id/messages — get messages for a conversation
// ---------------------------------------------------------------------------

chatRoutes.get("/conversations/:id/messages", async (c) => {
  const userId = c.get("userId");
  const conversationId = Number(c.req.param("id"));

  if (Number.isNaN(conversationId)) {
    return c.json<ApiResponse<never>>({ success: false, error: "Invalid conversation ID" }, 400);
  }

  // Verify ownership
  const [convo] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  if (!convo) {
    return c.json<ApiResponse<never>>({ success: false, error: "Conversation not found" }, 404);
  }

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  // Parse recipeData JSON for each message
  const parsed = rows.map((msg) => ({
    ...msg,
    recipeData: safeJsonParse(msg.recipeData, null),
  }));

  return c.json<ApiResponse<typeof parsed>>({ success: true, data: parsed });
});

// ---------------------------------------------------------------------------
// DELETE /conversations/:id — delete a conversation and its messages
// ---------------------------------------------------------------------------

chatRoutes.delete("/conversations/:id", async (c) => {
  const userId = c.get("userId");
  const conversationId = Number(c.req.param("id"));

  if (Number.isNaN(conversationId)) {
    return c.json<ApiResponse<never>>({ success: false, error: "Invalid conversation ID" }, 400);
  }

  const [convo] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);

  if (!convo) {
    return c.json<ApiResponse<never>>({ success: false, error: "Conversation not found" }, 404);
  }

  // Delete messages first (FK constraint), then the conversation
  await db.delete(messages).where(eq(messages.conversationId, conversationId));
  await db.delete(conversations).where(eq(conversations.id, conversationId));

  return c.json<ApiResponse<{ deleted: true }>>({ success: true, data: { deleted: true } });
});

// ---------------------------------------------------------------------------
// POST / — Main chat endpoint (SSE streaming)
// ---------------------------------------------------------------------------

chatRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => null) as {
    conversationId?: number;
    message?: string;
  } | null;

  if (!body?.message?.trim()) {
    return c.json<ApiResponse<never>>({ success: false, error: "Message is required" }, 400);
  }

  const userMessage = body.message.trim();
  let conversationId = body.conversationId ?? null;
  let isFirstMessage = false;

  // ── Resolve or create conversation ──────────────────────────────

  if (conversationId) {
    const [convo] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);

    if (!convo) {
      return c.json<ApiResponse<never>>({ success: false, error: "Conversation not found" }, 404);
    }
  } else {
    const [created] = await db
      .insert(conversations)
      .values({ userId, title: "New Chat" })
      .returning();

    if (!created) {
      return c.json<ApiResponse<never>>({ success: false, error: "Failed to create conversation" }, 500);
    }

    conversationId = created.id;
    isFirstMessage = true;
  }

  // ── Save user message ───────────────────────────────────────────

  const [savedUserMsg] = await db
    .insert(messages)
    .values({ conversationId, role: "user", content: userMessage })
    .returning();

  if (!savedUserMsg) {
    return c.json<ApiResponse<never>>({ success: false, error: "Failed to save message" }, 500);
  }

  // ── Build message history for AI ────────────────────────────────

  const previousMessages = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  // ── Get user dietary preferences ────────────────────────────────

  const [dbUser] = await db
    .select({ dietaryPreferences: users.dietaryPreferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  let preferences: DietaryPreferences | null = null;
  if (dbUser?.dietaryPreferences) {
    try {
      preferences = JSON.parse(dbUser.dietaryPreferences) as DietaryPreferences;
    } catch {
      // Ignore malformed prefs
    }
  }

  // ── Stream AI response via SSE ──────────────────────────────────

  const aiStream = AIService.streamChat(previousMessages, preferences);
  const reader = aiStream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // We need to capture the conversation/message IDs for the final event
  const capturedConversationId = conversationId;
  const capturedIsFirstMessage = isFirstMessage;
  const capturedUserMessage = userMessage;

  const responseStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullContent = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          // Parse SSE events from the AI stream to buffer content
          const lines = chunk.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const payload = trimmed.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload) as { content?: string; error?: string };
              if (parsed.content) {
                fullContent += parsed.content;
              }
            } catch {
              // Skip malformed chunks
            }
          }

          // Forward the raw SSE chunk to the client
          controller.enqueue(value);
        }

        // ── Stream complete — persist assistant message ────────────

        const recipeData = parseRecipes(fullContent);
        const recipeDataJson = recipeData.length > 0 ? JSON.stringify(recipeData) : null;

        const [savedAssistantMsg] = await db
          .insert(messages)
          .values({
            conversationId: capturedConversationId,
            role: "assistant",
            content: fullContent,
            recipeData: recipeDataJson,
          })
          .returning();

        // ── Generate title for first message (fire-and-forget) ────

        if (capturedIsFirstMessage) {
          AIService.generateTitle(capturedUserMessage)
            .then(async (title) => {
              await db
                .update(conversations)
                .set({ title })
                .where(eq(conversations.id, capturedConversationId));
            })
            .catch((err) => {
              console.error("[Chat] Failed to generate title:", err);
            });
        }

        // ── Send final metadata event ─────────────────────────────

        const finalEvent = `data: ${JSON.stringify({
          done: true,
          conversationId: capturedConversationId,
          messageId: savedAssistantMsg?.id ?? null,
          recipeData: recipeData.length > 0 ? recipeData : null,
        })}\n\n`;

        controller.enqueue(encoder.encode(finalEvent));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream processing error";
        const errorEvent = `data: ${JSON.stringify({ error: message })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
