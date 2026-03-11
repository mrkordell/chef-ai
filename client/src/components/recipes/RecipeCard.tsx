import { useCallback, useState } from "react";
import {
  BookmarkCheck,
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Clock,
  MessageSquare,
  Users,
} from "lucide-react";
import type { Recipe } from "../../../../shared/types.ts";
import { saveRecipe } from "../../lib/api.ts";
import { cn, formatCookTime } from "../../lib/utils.ts";
import { Badge } from "../ui/badge.tsx";
import { Button } from "../ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card.tsx";
import NutritionLabel from "./NutritionLabel.tsx";

type RecipeCardProps = {
  recipe: Recipe;
  onChatAbout?: (recipe: Recipe) => void;
  compact?: boolean;
};

export default function RecipeCard({
  recipe,
  onChatAbout,
  compact = false,
}: RecipeCardProps) {
  const [isSaved, setIsSaved] = useState(!!recipe.id);
  const [isSaving, setIsSaving] = useState(false);
  const [showIngredients, setShowIngredients] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleSave = useCallback(async () => {
    if (isSaved || isSaving) return;
    setIsSaving(true);

    try {
      const result = await saveRecipe(recipe);
      if (result.success) {
        setIsSaved(true);
      }
    } finally {
      setIsSaving(false);
    }
  }, [recipe, isSaved, isSaving]);

  const handleChatAbout = useCallback(() => {
    onChatAbout?.(recipe);
  }, [recipe, onChatAbout]);

  if (compact) {
    return (
      <div className="rounded-lg border border-surface-200 bg-white p-3">
        <p className="text-sm font-medium truncate">{recipe.title}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
          <Clock className="h-3 w-3" />
          <span>{formatCookTime(recipe.cookTimeMin)}</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="animate-[fade-in_0.3s_ease-out] overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">
            {recipe.title}
          </CardTitle>
          <Badge variant="default" className="shrink-0">
            {recipe.cuisine}
          </Badge>
        </div>
        <p className="text-sm text-text-secondary mt-1">{recipe.description}</p>

        <div className="flex items-center gap-4 mt-3 text-sm text-text-muted">
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatCookTime(recipe.cookTimeMin)}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {recipe.servings} servings
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Nutrition */}
        <NutritionLabel nutrition={recipe.nutrition} />

        {/* Ingredients (expandable) */}
        <div>
          <button
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-50 transition-colors"
            onClick={() => setShowIngredients(!showIngredients)}
            aria-expanded={showIngredients}
          >
            <span>
              Ingredients ({recipe.ingredients.length})
            </span>
            {showIngredients ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showIngredients && (
            <ul className="mt-1 space-y-1 px-3 animate-[fade-in_0.2s_ease-out]">
              {recipe.ingredients.map((ingredient, i) => (
                <li
                  key={`${ingredient.name}-${i}`}
                  className="flex items-baseline gap-2 text-sm"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-400 shrink-0 mt-1.5" />
                  <span>
                    <strong className="font-medium">
                      {ingredient.amount} {ingredient.unit}
                    </strong>{" "}
                    {ingredient.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Instructions (expandable) */}
        <div>
          <button
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-text-primary hover:bg-surface-50 transition-colors"
            onClick={() => setShowInstructions(!showInstructions)}
            aria-expanded={showInstructions}
          >
            <span>
              Instructions ({recipe.instructions.length} steps)
            </span>
            {showInstructions ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {showInstructions && (
            <ol className="mt-1 space-y-2 px-3 animate-[fade-in_0.2s_ease-out]">
              {recipe.instructions.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="pt-0.5 leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            variant={isSaved ? "secondary" : "outline"}
            size="sm"
            onClick={handleSave}
            disabled={isSaved || isSaving}
            className="gap-1.5"
          >
            {isSaved ? (
              <>
                <BookmarkCheck className="h-4 w-4" />
                Saved
              </>
            ) : (
              <>
                <BookmarkPlus className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save Recipe"}
              </>
            )}
          </Button>

          {onChatAbout && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleChatAbout}
              className="gap-1.5"
            >
              <MessageSquare className="h-4 w-4" />
              Ask Chef AI
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
