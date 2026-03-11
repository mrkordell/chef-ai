import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ChefHat, Search } from "lucide-react";
import type { Recipe } from "../../../shared/types.ts";
import { deleteRecipe, fetchRecipes } from "../lib/api.ts";
import { useChat } from "../hooks/useChat.ts";
import Sidebar from "../components/layout/Sidebar.tsx";
import RecipeCard from "../components/recipes/RecipeCard.tsx";
import { Input } from "../components/ui/input.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Button } from "../components/ui/button.tsx";
import { cn } from "../lib/utils.ts";

const CUISINE_OPTIONS = [
  "All",
  "Italian",
  "Mexican",
  "Asian",
  "Indian",
  "Mediterranean",
  "American",
  "French",
  "Japanese",
  "Thai",
  "Other",
] as const;

export default function RecipesPage() {
  const navigate = useNavigate();
  const {
    conversations,
    activeConversationId,
    loadConversation,
    loadConversations,
    newConversation,
    deleteConversation,
    sendMessage,
  } = useChat();

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("All");

  const loadRecipes = useCallback(async () => {
    setIsLoading(true);
    const params: { cuisine?: string; search?: string } = {};
    if (selectedCuisine !== "All") params.cuisine = selectedCuisine;
    if (searchQuery.trim()) params.search = searchQuery.trim();

    const result = await fetchRecipes(params);
    if (result.success && result.data) {
      setRecipes(result.data);
    }
    setIsLoading(false);
  }, [selectedCuisine, searchQuery]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  const handleChatAboutRecipe = useCallback(
    (recipe: Recipe) => {
      newConversation();
      sendMessage(
        `Tell me more about "${recipe.title}". Any tips for making it?`,
      );
      navigate("/chat");
    },
    [newConversation, sendMessage, navigate],
  );

  return (
    <div className="flex min-h-screen">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={loadConversation}
        onNewConversation={newConversation}
        onDeleteConversation={deleteConversation}
      />

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary-500" />
              My Recipes
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Your saved recipes from Chef AI conversations
            </p>
          </div>

          {/* Search and filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                placeholder="Search recipes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {CUISINE_OPTIONS.map((cuisine) => (
                <button
                  key={cuisine}
                  onClick={() => setSelectedCuisine(cuisine)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    selectedCuisine === cuisine
                      ? "bg-primary-500 text-white"
                      : "bg-surface-100 text-text-secondary hover:bg-surface-200",
                  )}
                >
                  {cuisine}
                </button>
              ))}
            </div>
          </div>

          {/* Recipe grid */}
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-64 rounded-xl bg-surface-100 animate-pulse"
                />
              ))}
            </div>
          ) : recipes.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onChatAbout={handleChatAboutRecipe}
                />
              ))}
            </div>
          ) : (
            <EmptyRecipes onGoToChat={() => navigate("/chat")} />
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyRecipes({ onGoToChat }: { onGoToChat: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 mb-4">
        <ChefHat className="h-9 w-9" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">
        No saved recipes yet
      </h2>
      <p className="text-sm text-text-secondary max-w-sm mb-6">
        Chat with Chef AI to discover delicious meals, then save your favorites
        here for easy access.
      </p>
      <Button onClick={onGoToChat}>
        <ChefHat className="h-4 w-4" />
        Chat with Chef AI
      </Button>
    </div>
  );
}
