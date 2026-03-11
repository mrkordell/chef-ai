import type { DietaryPreferences } from "../../../shared/types.ts";
import { config } from "../config.ts";

// ── Config ──────────────────────────────────────────────────────────

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const API_KEY = config.OPENROUTER_API_KEY;
const MODEL = config.AI_MODEL;

// ── System prompt ───────────────────────────────────────────────────

const CHEF_SYSTEM_PROMPT = `You are Chef AI — a warm, knowledgeable, and encouraging chef who loves helping people cook delicious food. You combine professional culinary expertise with a friendly, conversational style. Toss in the occasional food-related pun or joke to keep things fun ("I'm on a roll today — and not just the sourdough kind!").

## Core Rules

1. **Respect dietary needs absolutely.** If the user has dietary preferences or allergies (listed below under USER PREFERENCES), never suggest anything that violates them. When substituting, explain why the swap works.

2. **Structured recipe output.** Whenever you generate or suggest a complete recipe, you MUST include a structured JSON block wrapped in a \`\`\`recipe code fence. The JSON must match this schema exactly:
\`\`\`
{
  "title": string,
  "description": string,
  "ingredients": [{ "name": string, "amount": string, "unit": string }],
  "instructions": ["Step 1...", "Step 2..."],
  "nutrition": { "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number },
  "cuisine": string,
  "cookTimeMin": number,
  "servings": number
}
\`\`\`
Always provide nutritional estimates (per serving) for every recipe.

3. **Cooking mode.** When the user says "let's cook this", "start cooking", "walk me through it", or similar, switch to step-by-step cooking mode:
   - Present ONE step at a time.
   - Wait for the user to say "next", "done", "continue", or similar before proceeding.
   - Offer tips or timing cues relevant to the current step.
   - When all steps are done, congratulate them!

4. **Meal plans.** When asked for a meal plan, generate a complete weekly plan and wrap it in a \`\`\`mealplan code fence as JSON:
\`\`\`
{
  "name": string,
  "meals": [
    { "day": 0-6, "mealType": "breakfast"|"lunch"|"dinner"|"snack", "recipe": { ...full recipe object... } }
  ]
}
\`\`\`
Days are 0 = Monday through 6 = Sunday.

5. **Ingredient-based suggestions.** When the user lists ingredients they have on hand, suggest creative recipes that primarily use those ingredients. Minimize extra shopping.

6. **General food knowledge.** You can discuss cooking techniques, ingredient substitutions, food storage tips, kitchen equipment, food science, and culinary history. Be helpful and thorough.

7. **Be conversational.** Use natural language around the structured blocks. Introduce recipes with enthusiasm, explain your choices, and ask follow-up questions to refine suggestions.`;

/**
 * Build the full system prompt by injecting user dietary preferences.
 */
function buildSystemPrompt(
  preferences?: DietaryPreferences | null,
): string {
  if (!preferences) {
    return `${CHEF_SYSTEM_PROMPT}\n\n## USER PREFERENCES\nNo specific dietary preferences provided. Ask if they have any!`;
  }

  const lines: string[] = [];

  const flags: Array<[keyof DietaryPreferences, string]> = [
    ["vegetarian", "Vegetarian"],
    ["vegan", "Vegan"],
    ["glutenFree", "Gluten-free"],
    ["dairyFree", "Dairy-free"],
    ["keto", "Keto"],
    ["paleo", "Paleo"],
  ];

  const activeDiets = flags
    .filter(([key]) => preferences[key])
    .map(([, label]) => label);

  if (activeDiets.length > 0) {
    lines.push(`- Diet: ${activeDiets.join(", ")}`);
  }

  if (preferences.allergies.length > 0) {
    lines.push(
      `- ALLERGIES (CRITICAL — never include these): ${preferences.allergies.join(", ")}`,
    );
  }

  if (preferences.cuisinePreferences.length > 0) {
    lines.push(
      `- Preferred cuisines: ${preferences.cuisinePreferences.join(", ")}`,
    );
  }

  if (preferences.cookingSkill) {
    lines.push(`- Cooking skill level: ${preferences.cookingSkill}`);
  }

  const prefsBlock =
    lines.length > 0
      ? lines.join("\n")
      : "No specific dietary preferences provided.";

  return `${CHEF_SYSTEM_PROMPT}\n\n## USER PREFERENCES\n${prefsBlock}`;
}

// ── Streaming chat ──────────────────────────────────────────────────

type ChatInput = {
  role: string;
  content: string;
};

/**
 * Stream a chat completion from OpenRouter. Returns a ReadableStream that
 * emits Server-Sent Events: `data: {"content":"..."}\n\n` per chunk,
 * ending with `data: [DONE]\n\n`.
 */
function streamChat(
  messages: ChatInput[],
  userPreferences?: DietaryPreferences | null,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const systemPrompt = buildSystemPrompt(userPreferences);

        const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_KEY}`,
            "HTTP-Referer": "https://chef-ai.app",
            "X-Title": "Chef AI",
          },
          body: JSON.stringify({
            model: MODEL,
            stream: true,
            messages: [
              { role: "system", content: systemPrompt },
              ...messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            ],
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          const errorEvent = `data: ${JSON.stringify({ error: `OpenRouter API error (${response.status}): ${errorBody}` })}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        if (!response.body) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "No response body from OpenRouter" })}\n\n`,
            ),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE lines are separated by double newlines; process complete events
          const lines = buffer.split("\n");
          // Keep the last (possibly incomplete) line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;

            if (trimmed === "data: [DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            if (trimmed.startsWith("data: ")) {
              const jsonStr = trimmed.slice(6);
              try {
                const parsed = JSON.parse(jsonStr) as {
                  choices?: Array<{
                    delta?: { content?: string };
                  }>;
                };
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  const event = `data: ${JSON.stringify({ content })}\n\n`;
                  controller.enqueue(encoder.encode(event));
                }
              } catch {
                // Skip malformed JSON chunks — upstream SSE can be noisy
              }
            }
          }
        }

        // Stream ended without explicit [DONE] — close cleanly
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown AI service error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: message })}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}

// ── Title generation ────────────────────────────────────────────────

/**
 * Generate a short 3-5 word conversation title from the user's first message.
 * Non-streaming call — returns the title string directly.
 */
async function generateTitle(firstMessage: string): Promise<string> {
  try {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "HTTP-Referer": "https://chef-ai.app",
        "X-Title": "Chef AI",
      },
      body: JSON.stringify({
        model: MODEL,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "Generate a short, descriptive title (3-5 words) for a cooking conversation that starts with the following message. Return ONLY the title text, nothing else. No quotes, no punctuation at the end.",
          },
          { role: "user", content: firstMessage },
        ],
        max_tokens: 20,
      }),
    });

    if (!response.ok) {
      console.error(
        `[AIService] Title generation failed: ${response.status}`,
      );
      return "New Conversation";
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const title = data.choices?.[0]?.message?.content?.trim();
    return title || "New Conversation";
  } catch (err) {
    console.error("[AIService] Title generation error:", err);
    return "New Conversation";
  }
}

// ── Public API ──────────────────────────────────────────────────────

export const AIService = {
  streamChat,
  generateTitle,
} as const;
