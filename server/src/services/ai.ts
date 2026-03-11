import type { DietaryPreferences } from "../../../shared/types.ts";
import { config } from "../config.ts";
import { CHEF_TOOLS } from "./tool-definitions.ts";

// ── Config ──────────────────────────────────────────────────────────

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const API_KEY = config.OPENROUTER_API_KEY;
const MODEL = config.AI_MODEL;

// ── System prompt ───────────────────────────────────────────────────

const CHEF_SYSTEM_PROMPT = `You are Chef AI — a warm, knowledgeable, and encouraging chef who loves helping people cook delicious food. You combine professional culinary expertise with a friendly, conversational style. Toss in the occasional food-related pun or joke to keep things fun ("I'm on a roll today — and not just the sourdough kind!").

## Core Rules

1. **Respect dietary needs absolutely.** If the user has dietary preferences or allergies (listed below under USER PREFERENCES), never suggest anything that violates them. When substituting, explain why the swap works.

2. **Use tools for structured data.** When you have a recipe, call save_recipe. When you have a meal plan, call save_meal_plan. NEVER write recipe JSON in your text. Text is purely conversational.

3. **Write a brief conversational intro, then call the tool.** Don't duplicate recipe details in prose — the tool call carries the structured data. Keep your text response short and friendly: introduce the dish, mention why it's a good fit, and let the tool handle the details.

3a. **Transition into tool calls naturally.** When you're about to call save_recipe or save_meal_plan, end your text with a warm, chef-themed line that signals something is coming — e.g. "Let me cook that up for you!", "Let me put this together for you…", "Give me just a moment to plate this up…", "Let me get the full recipe ready…". Vary these naturally — don't repeat the same phrase. The goal: the user should *expect* that a recipe or meal plan is about to appear. Never say anything meta like "I'm calling a tool" or "using save_recipe". When you're NOT calling a tool (just chatting, answering technique questions, etc.), do NOT use these transition phrases.

4. **Cooking mode.** When the user says "let's cook this", "start cooking", "walk me through it", or similar, switch to step-by-step cooking mode:
   - Present ONE step at a time.
   - Wait for the user to say "next", "done", "continue", or similar before proceeding.
   - Offer tips or timing cues relevant to the current step.
   - When all steps are done, congratulate them!

5. **Ingredient-based suggestions.** When the user lists ingredients they have on hand, suggest creative recipes that primarily use those ingredients. Minimize extra shopping.

6. **General food knowledge.** You can discuss cooking techniques, ingredient substitutions, food storage tips, kitchen equipment, food science, and culinary history. Be helpful and thorough.

7. **Be conversational.** Use natural language. Introduce recipes with enthusiasm, explain your choices, and ask follow-up questions to refine suggestions.`;

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

// ── Types for tool call accumulation ────────────────────────────────

type AccumulatedToolCall = {
  id: string;
  name: string;
  arguments: string;
};

// ── Streaming chat ──────────────────────────────────────────────────

type ChatInput = {
  role: string;
  content: string;
};

/**
 * Stream a chat completion from OpenRouter with tool support.
 *
 * Emits SSE events:
 *   - `{"content":"..."}` — text token from the model
 *   - `{"tool_call":{"name":"save_recipe","call_id":"...","data":{...}}}` — parsed tool call
 *   - `{"stream_complete":true,"fullContent":"..."}` — signals end, carries full text for DB
 *   - `{"error":"..."}` — on failure
 *   - `[DONE]` — terminal sentinel
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
            tools: CHEF_TOOLS,
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
        let fullContent = "";

        // Accumulate tool calls by index
        const toolCalls = new Map<number, AccumulatedToolCall>();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE lines are separated by newlines; process complete events
          const lines = buffer.split("\n");
          // Keep the last (possibly incomplete) line in the buffer
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;

            if (trimmed === "data: [DONE]") {
              // Stream from upstream is done — emit accumulated tool calls,
              // then stream_complete, then our own [DONE]
              for (const [, tc] of toolCalls) {
                try {
                  const data = JSON.parse(tc.arguments);
                  const toolCallEvent = `data: ${JSON.stringify({
                    tool_call: {
                      name: tc.name,
                      call_id: tc.id,
                      data,
                    },
                  })}\n\n`;
                  controller.enqueue(encoder.encode(toolCallEvent));
                } catch (parseErr) {
                  console.error(
                    `[AIService] Failed to parse tool call arguments for ${tc.name}:`,
                    parseErr,
                  );
                }
              }

              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ stream_complete: true, fullContent })}\n\n`,
                ),
              );
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
              return;
            }

            if (trimmed.startsWith("data: ")) {
              const jsonStr = trimmed.slice(6);
              try {
                const parsed = JSON.parse(jsonStr) as {
                  choices?: Array<{
                    delta?: {
                      content?: string;
                      tool_calls?: Array<{
                        index: number;
                        id?: string;
                        function?: {
                          name?: string;
                          arguments?: string;
                        };
                      }>;
                    };
                  }>;
                };

                const delta = parsed.choices?.[0]?.delta;

                // ── Handle text content ──
                if (delta?.content) {
                  fullContent += delta.content;
                  const event = `data: ${JSON.stringify({ content: delta.content })}\n\n`;
                  controller.enqueue(encoder.encode(event));
                }

                // ── Handle tool calls (buffered server-side) ──
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index;
                    let accumulated = toolCalls.get(idx);

                    if (!accumulated) {
                      accumulated = {
                        id: tc.id ?? "",
                        name: tc.function?.name ?? "",
                        arguments: "",
                      };
                      toolCalls.set(idx, accumulated);

                      // Notify client that a tool call has started (for cooking indicator)
                      const startEvent = `data: ${JSON.stringify({
                        tool_call_start: { name: tc.function?.name ?? "", index: idx },
                      })}\n\n`;
                      controller.enqueue(encoder.encode(startEvent));
                    }

                    // The id and name may arrive in the first chunk only
                    if (tc.id && !accumulated.id) {
                      accumulated.id = tc.id;
                    }
                    if (tc.function?.name && !accumulated.name) {
                      accumulated.name = tc.function.name;
                    }

                    // Arguments are streamed incrementally
                    if (tc.function?.arguments) {
                      accumulated.arguments += tc.function.arguments;
                    }
                  }
                }
              } catch {
                // Skip malformed JSON chunks — upstream SSE can be noisy
              }
            }
          }
        }

        // Stream ended without explicit [DONE] — emit accumulated data and close
        for (const [, tc] of toolCalls) {
          try {
            const data = JSON.parse(tc.arguments);
            const toolCallEvent = `data: ${JSON.stringify({
              tool_call: {
                name: tc.name,
                call_id: tc.id,
                data,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(toolCallEvent));
          } catch (parseErr) {
            console.error(
              `[AIService] Failed to parse tool call arguments for ${tc.name}:`,
              parseErr,
            );
          }
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ stream_complete: true, fullContent })}\n\n`,
          ),
        );
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
