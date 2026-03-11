import { ChefHat, User } from "lucide-react";
import Markdown from "react-markdown";
import type { ChatMessage, Recipe } from "../../../../shared/types.ts";
import { cn } from "../../lib/utils.ts";
import { Avatar, AvatarFallback } from "../ui/avatar.tsx";
import RecipeCard from "../recipes/RecipeCard.tsx";

type MessageBubbleProps = {
  message: ChatMessage;
  onChatAboutRecipe?: (recipe: Recipe) => void;
};

export default function MessageBubble({
  message,
  onChatAboutRecipe,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 animate-[fade-in_0.3s_ease-out]",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0 mt-1">
        <AvatarFallback
          className={cn(
            "text-xs",
            isUser
              ? "bg-surface-200 text-text-secondary"
              : "bg-primary-500 text-white",
          )}
        >
          {isUser ? (
            <User className="h-4 w-4" />
          ) : (
            <ChefHat className="h-4 w-4" />
          )}
        </AvatarFallback>
      </Avatar>

      {/* Message content */}
      <div
        className={cn(
          "max-w-[75%] space-y-3",
          isUser ? "items-end" : "items-start",
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-primary-500 text-white rounded-br-md"
              : "bg-surface-100 text-text-primary rounded-bl-md",
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-chat">
              <Markdown>{message.content}</Markdown>
            </div>
          )}
        </div>

        {/* Recipe card if present */}
        {message.recipeData && (
          <div className="w-full max-w-md">
            <RecipeCard
              recipe={message.recipeData}
              onChatAbout={onChatAboutRecipe}
            />
          </div>
        )}
      </div>
    </div>
  );
}
