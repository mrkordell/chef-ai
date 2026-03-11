import type {
  ApiResponse,
  AuthResponse,
  ChatMessage,
  Conversation,
  DietaryPreferences,
  MealPlan,
  Recipe,
  User,
} from "../../../shared/types.ts";

// ── Token management ────────────────────────────────────────────────

const TOKEN_KEY = "chef-ai-token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Base fetch wrapper ──────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    // Don't hard-redirect — let React's AuthGuard handle navigation.
    // A full page reload here would re-trigger the auth check and loop.
    return { success: false, error: "Unauthorized" };
  }

  const data: ApiResponse<T> = await response.json();
  return data;
}

// ── Auth ────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string,
): Promise<ApiResponse<AuthResponse>> {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<ApiResponse<AuthResponse>> {
  return apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, name }),
  });
}

export async function fetchMe(): Promise<ApiResponse<User>> {
  return apiFetch<User>("/api/auth/me");
}

// ── Chat ────────────────────────────────────────────────────────────

export type SSECallbacks = {
  onContent: (content: string) => void;
  onToolCall: (toolCall: { name: string; call_id: string; data: unknown }) => void;
  onToolCallStart?: (info: { name: string; index: number }) => void;
  onDone: (data: { conversationId: number; messageId: number }) => void;
  onError: (error: string) => void;
};

export async function sendMessage(
  message: string,
  conversationId: number | null,
  callbacks: SSECallbacks,
): Promise<void> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers,
      body: JSON.stringify({
        message,
        conversationId: conversationId ?? undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      callbacks.onError(
        errorData?.error ?? `Request failed with status ${response.status}`,
      );
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError("No response body");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;

        const jsonStr = trimmed.slice(6);
        if (!jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr);

          if (parsed.done) {
            callbacks.onDone({
              conversationId: parsed.conversationId,
              messageId: parsed.messageId,
            });
          } else if (parsed.tool_call_start) {
            callbacks.onToolCallStart?.(parsed.tool_call_start);
          } else if (parsed.tool_call) {
            callbacks.onToolCall(parsed.tool_call);
          } else if (parsed.content !== undefined) {
            callbacks.onContent(parsed.content);
          } else if (parsed.error) {
            callbacks.onError(parsed.error);
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } catch (err) {
    callbacks.onError(
      err instanceof Error ? err.message : "Network error",
    );
  }
}

// ── Conversations ───────────────────────────────────────────────────

export async function fetchConversations(): Promise<
  ApiResponse<Conversation[]>
> {
  return apiFetch<Conversation[]>("/api/chat/conversations");
}

export async function createConversation(): Promise<
  ApiResponse<Conversation>
> {
  return apiFetch<Conversation>("/api/chat/conversations", {
    method: "POST",
  });
}

export async function fetchMessages(
  conversationId: number,
): Promise<ApiResponse<ChatMessage[]>> {
  return apiFetch<ChatMessage[]>(
    `/api/chat/conversations/${conversationId}/messages`,
  );
}

export async function deleteConversation(
  conversationId: number,
): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/api/chat/conversations/${conversationId}`, {
    method: "DELETE",
  });
}

// ── Recipes ─────────────────────────────────────────────────────────

export async function fetchRecipes(params?: {
  cuisine?: string;
  search?: string;
}): Promise<ApiResponse<Recipe[]>> {
  const searchParams = new URLSearchParams();
  if (params?.cuisine) searchParams.set("cuisine", params.cuisine);
  if (params?.search) searchParams.set("search", params.search);

  const query = searchParams.toString();
  return apiFetch<Recipe[]>(`/api/recipes${query ? `?${query}` : ""}`);
}

export async function saveRecipe(
  recipe: Recipe,
): Promise<ApiResponse<Recipe>> {
  return apiFetch<Recipe>("/api/recipes", {
    method: "POST",
    body: JSON.stringify(recipe),
  });
}

export async function deleteRecipe(
  recipeId: number,
): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/api/recipes/${recipeId}`, {
    method: "DELETE",
  });
}

// ── Meal Plans ──────────────────────────────────────────────────────

export async function fetchMealPlans(): Promise<ApiResponse<MealPlan[]>> {
  return apiFetch<MealPlan[]>("/api/meal-plans");
}

export async function createMealPlan(
  plan: Pick<MealPlan, "name" | "startDate" | "meals">,
): Promise<ApiResponse<MealPlan>> {
  return apiFetch<MealPlan>("/api/meal-plans", {
    method: "POST",
    body: JSON.stringify(plan),
  });
}

export async function updateMealPlan(
  id: number,
  updates: Partial<Pick<MealPlan, "name" | "startDate" | "meals">>,
): Promise<ApiResponse<MealPlan>> {
  return apiFetch<MealPlan>(`/api/meal-plans/${id}`, {
    method: "PUT",
    body: JSON.stringify(updates),
  });
}

export async function deleteMealPlan(
  id: number,
): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/api/meal-plans/${id}`, {
    method: "DELETE",
  });
}

// ── Preferences ─────────────────────────────────────────────────────

export async function fetchPreferences(): Promise<
  ApiResponse<DietaryPreferences>
> {
  return apiFetch<DietaryPreferences>("/api/preferences");
}

export async function updatePreferences(
  preferences: DietaryPreferences,
): Promise<ApiResponse<User>> {
  return apiFetch<User>("/api/preferences", {
    method: "PUT",
    body: JSON.stringify(preferences),
  });
}
