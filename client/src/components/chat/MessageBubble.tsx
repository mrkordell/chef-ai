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

/**
 * Extract recipes from a message, supporting both the new tool-call path
 * and the legacy `recipeData` field from older messages in the DB.
 */
function getRecipesFromMessage(message: ChatMessage): Recipe[] {
  // New path: extract from tool calls
  if (message.toolCalls && message.toolCalls.length > 0) {
    const recipes: Recipe[] = [];
    for (const tc of message.toolCalls) {
      if (tc.name === "save_recipe" && tc.data && typeof tc.data === "object") {
        recipes.push(tc.data as Recipe);
      }
      if (tc.name === "save_meal_plan") {
        const plan = tc.data as { meals: Array<{ recipe: Recipe }> };
        for (const meal of plan.meals ?? []) {
          if (meal.recipe) recipes.push(meal.recipe);
        }
      }
    }
    if (recipes.length > 0) return recipes;
  }

  // Legacy path: recipeData from old code-fence parsing
  // Handle both single Recipe and Recipe[] (old bug stored arrays)
  if (message.recipeData) {
    if (Array.isArray(message.recipeData)) {
      return message.recipeData as Recipe[];
    }
    return [message.recipeData];
  }

  return [];
}

export default function MessageBubble({
  message,
  onChatAboutRecipe,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const recipes = getRecipesFromMessage(message);
  const hasContent = message.content.trim().length > 0;

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
        {hasContent && (
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
        )}

        {/* Recipe cards */}
        {recipes.map((recipe, i) => (
          <div
            key={`recipe-${recipe.title}-${i}`}
            className="w-full max-w-md animate-[fade-in_0.3s_ease-out]"
            style={recipes.length > 1 ? { animationDelay: `${i * 100}ms`, animationFillMode: "backwards" } : undefined}
          >
            <RecipeCard recipe={recipe} onChatAbout={onChatAboutRecipe} />
          </div>
        ))}
      </div>
    </div>
  );
}
