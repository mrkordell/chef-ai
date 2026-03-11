import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ChefHat, Plus, Trash2 } from "lucide-react";
import type { MealPlan, MealPlanItem } from "../../../shared/types.ts";
import { deleteMealPlan, fetchMealPlans } from "../lib/api.ts";
import { useChat } from "../hooks/useChat.ts";
import { cn, formatCookTime } from "../lib/utils.ts";
import Sidebar from "../components/layout/Sidebar.tsx";
import { Button } from "../components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Separator } from "../components/ui/separator.tsx";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"] as const;

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export default function MealPlanPage() {
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

  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    const result = await fetchMealPlans();
    if (result.success && result.data) {
      setMealPlans(result.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    loadConversations();
    loadPlans();
  }, [loadConversations, loadPlans]);

  const handleAskChefAI = useCallback(() => {
    newConversation();
    sendMessage(
      "Please plan my meals for the week. Include breakfast, lunch, dinner, and a snack for each day. Consider variety and balanced nutrition.",
    );
    navigate("/chat");
  }, [newConversation, sendMessage, navigate]);

  const handleDeletePlan = useCallback(
    async (id: number) => {
      await deleteMealPlan(id);
      setMealPlans((prev) => prev.filter((p) => p.id !== id));
    },
    [],
  );

  const getMealForSlot = (
    meals: MealPlanItem[],
    day: number,
    mealType: string,
  ): MealPlanItem | undefined => {
    return meals.find((m) => m.day === day && m.mealType === mealType);
  };

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
        <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                <Calendar className="h-6 w-6 text-primary-500" />
                Meal Plans
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                Organize your weekly meals with Chef AI
              </p>
            </div>

            <Button onClick={handleAskChefAI} className="gap-2">
              <ChefHat className="h-4 w-4" />
              Ask Chef AI to plan my week
            </Button>
          </div>

          {/* Meal plans */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-48 rounded-xl bg-surface-100 animate-pulse"
                />
              ))}
            </div>
          ) : mealPlans.length > 0 ? (
            <div className="space-y-6">
              {mealPlans.map((plan) => (
                <Card key={plan.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{plan.name}</CardTitle>
                        <p className="text-sm text-text-muted mt-1">
                          Starting {plan.startDate}
                        </p>
                      </div>
                      {plan.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePlan(plan.id!)}
                          aria-label={`Delete meal plan: ${plan.name}`}
                          className="text-text-muted hover:text-danger-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent>
                    {/* Desktop: grid view */}
                    <div className="hidden lg:block overflow-x-auto">
                      <div className="grid grid-cols-7 gap-2 min-w-[700px]">
                        {/* Day headers */}
                        {DAYS.map((day) => (
                          <div
                            key={day}
                            className="text-center text-xs font-semibold text-text-muted uppercase tracking-wider pb-2"
                          >
                            {day}
                          </div>
                        ))}

                        {/* Meal slots */}
                        {MEAL_TYPES.map((mealType) =>
                          DAYS.map((_, dayIndex) => {
                            const meal = getMealForSlot(
                              plan.meals,
                              dayIndex,
                              mealType,
                            );

                            return (
                              <div
                                key={`${dayIndex}-${mealType}`}
                                className={cn(
                                  "rounded-lg border p-2 min-h-[60px]",
                                  meal
                                    ? "border-primary-200 bg-primary-50"
                                    : "border-dashed border-surface-300 bg-surface-50",
                                )}
                              >
                                <p className="text-[10px] font-semibold uppercase text-text-muted mb-1">
                                  {MEAL_TYPE_LABELS[mealType]}
                                </p>
                                {meal?.recipe ? (
                                  <p className="text-xs font-medium text-text-primary truncate">
                                    {meal.recipe.title}
                                  </p>
                                ) : (
                                  <p className="text-xs text-text-muted italic">
                                    Empty
                                  </p>
                                )}
                              </div>
                            );
                          }),
                        )}
                      </div>
                    </div>

                    {/* Mobile: stacked view */}
                    <div className="lg:hidden space-y-3">
                      {DAYS.map((day, dayIndex) => {
                        const dayMeals = plan.meals.filter(
                          (m) => m.day === dayIndex,
                        );
                        if (dayMeals.length === 0) return null;

                        return (
                          <div key={day}>
                            <p className="text-sm font-semibold text-text-primary mb-1.5">
                              {day}
                            </p>
                            <div className="space-y-1">
                              {dayMeals.map((meal, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 rounded-lg bg-surface-50 px-3 py-2"
                                >
                                  <Badge variant="secondary" className="text-[10px]">
                                    {MEAL_TYPE_LABELS[meal.mealType]}
                                  </Badge>
                                  <span className="text-sm truncate">
                                    {meal.recipe?.title ?? "No recipe"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyMealPlans onAskChefAI={handleAskChefAI} />
          )}
        </div>
      </main>
    </div>
  );
}

function EmptyMealPlans({ onAskChefAI }: { onAskChefAI: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-600 mb-4">
        <Calendar className="h-9 w-9" />
      </div>
      <h2 className="text-lg font-semibold text-text-primary mb-2">
        No meal plans yet
      </h2>
      <p className="text-sm text-text-secondary max-w-sm mb-6">
        Let Chef AI help you plan your meals for the week. Get balanced,
        delicious meals tailored to your preferences.
      </p>
      <Button onClick={onAskChefAI} className="gap-2">
        <ChefHat className="h-4 w-4" />
        Ask Chef AI to plan my week
      </Button>
    </div>
  );
}
