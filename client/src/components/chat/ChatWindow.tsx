import { useCallback, useEffect, useRef } from "react";
import { ChefHat, Sparkles } from "lucide-react";
import type { ChatMessage, Recipe, ToolCallEvent } from "../../../../shared/types.ts";
import { cn } from "../../lib/utils.ts";
import { Avatar, AvatarFallback } from "../ui/avatar.tsx";
import { ScrollArea } from "../ui/scroll-area.tsx";
import ChatInput from "./ChatInput.tsx";
import CookingIndicator from "./CookingIndicator.tsx";
import MessageBubble from "./MessageBubble.tsx";

type ChatWindowProps = {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamContent: string;
  currentToolCalls: ToolCallEvent[];
  pendingToolCalls: Array<{ name: string; index: number }>;
  onSend: (message: string) => void;
};

const SUGGESTIONS = [
  "What can I make with chicken, rice, and broccoli?",
  "Plan my meals for the week (vegetarian)",
  "I need a quick 15-minute dinner",
  "Help me use up these leftovers",
] as const;

export default function ChatWindow({
  messages,
  isStreaming,
  currentStreamContent,
  currentToolCalls,
  pendingToolCalls,
  onSend,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, currentStreamContent]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      onSend(suggestion);
    },
    [onSend],
  );

  const handleChatAboutRecipe = useCallback(
    (recipe: Recipe) => {
      onSend(`Tell me more about "${recipe.title}". Any tips for making it?`);
    },
    [onSend],
  );

  const isEmpty = messages.length === 0 && !isStreaming;

  return (
    <div className="flex h-screen flex-col">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState onSuggestionClick={handleSuggestionClick} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 p-4 pb-4 md:p-6">
            {messages.map((message, index) => (
              <MessageBubble
                key={message.id ?? `msg-${index}`}
                message={message}
                onChatAboutRecipe={handleChatAboutRecipe}
              />
            ))}

            {/* Streaming message */}
            {isStreaming && currentStreamContent && (
              <MessageBubble
                message={{
                  role: "assistant",
                  content: currentStreamContent,
                  toolCalls:
                    currentToolCalls.length > 0
                      ? currentToolCalls
                      : undefined,
                }}
                onChatAboutRecipe={handleChatAboutRecipe}
              />
            )}

            {/* Cooking indicator — tool call in progress but not yet resolved */}
            {isStreaming && pendingToolCalls.length > 0 && currentToolCalls.length === 0 && (
              <div className="flex gap-3">
                <div className="w-8 shrink-0" />
                <CookingIndicator
                  variant={pendingToolCalls.some(tc => tc.name === "save_meal_plan") ? "meal-plan" : "recipe"}
                  count={pendingToolCalls.filter(tc => tc.name === "save_recipe").length || 1}
                />
              </div>
            )}

            {/* Streaming indicator when no content yet */}
            {isStreaming && !currentStreamContent && (
              <div className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0 mt-1">
                  <AvatarFallback className="bg-primary-500 text-white text-xs">
                    <ChefHat className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="rounded-2xl rounded-bl-md bg-surface-100 px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-primary-400 animate-[pulse-gentle_1.4s_ease-in-out_infinite]" />
                    <div className="h-2 w-2 rounded-full bg-primary-400 animate-[pulse-gentle_1.4s_ease-in-out_0.2s_infinite]" />
                    <div className="h-2 w-2 rounded-full bg-primary-400 animate-[pulse-gentle_1.4s_ease-in-out_0.4s_infinite]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="mx-auto w-full max-w-3xl">
        <ChatInput onSend={onSend} isStreaming={isStreaming} />
      </div>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────

function EmptyState({
  onSuggestionClick,
}: {
  onSuggestionClick: (suggestion: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 py-12">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 mb-6">
        <ChefHat className="h-9 w-9" />
      </div>

      <h2 className="text-2xl font-bold text-text-primary mb-2">
        Welcome to Chef AI
      </h2>
      <p className="text-text-secondary text-center max-w-md mb-8">
        Your personal AI kitchen companion. Ask me about recipes, meal planning,
        cooking techniques, or what to make with ingredients you have on hand.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 w-full max-w-lg">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onSuggestionClick(suggestion)}
            className={cn(
              "flex items-start gap-3 rounded-xl border border-surface-200 bg-white p-4 text-left text-sm",
              "hover:border-primary-300 hover:bg-primary-50 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400",
            )}
          >
            <Sparkles className="h-4 w-4 text-primary-500 shrink-0 mt-0.5" />
            <span className="text-text-secondary">{suggestion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
