import { ChefHat } from "lucide-react";
import { Card } from "../ui/card.tsx";

type CookingIndicatorProps = {
  variant: "recipe" | "meal-plan";
  count?: number;
};

function getCookingLabel(variant: "recipe" | "meal-plan", count: number): string {
  if (variant === "meal-plan") return "Preparing your meal plan...";
  if (count === 1) return "Cooking up your recipe...";
  return `Cooking up ${count} recipes...`;
}

export default function CookingIndicator({ variant = "recipe", count = 1 }: CookingIndicatorProps) {
  const label = getCookingLabel(variant, count);

  return (
    <div className="w-full max-w-md animate-[fade-in_0.3s_ease-out]">
      <Card className="relative overflow-hidden" role="status" aria-label="Loading recipe">
        {/* Shimmer overlay */}
        <div
          className="absolute inset-0 animate-[shimmer_1.8s_ease-in-out_infinite]"
          style={{
            background: "linear-gradient(90deg, transparent 0%, var(--color-primary-50) 50%, transparent 100%)",
          }}
        />

        <div className="relative p-6 space-y-4">
          {/* Label */}
          <div className="flex items-center justify-center gap-2 pb-1">
            <ChefHat className="h-4 w-4 text-primary-500 animate-[spin-slow_3s_linear_infinite]" aria-hidden="true" />
            <span className="text-sm font-medium text-text-secondary">{label}</span>
          </div>

          {/* Skeleton: title */}
          <div className="h-4 w-3/4 rounded-md bg-primary-100/70" />

          {/* Skeleton: description */}
          <div className="space-y-2">
            <div className="h-3 w-full rounded-md bg-primary-100/50" />
            <div className="h-3 w-full rounded-md bg-primary-100/50" />
            <div className="h-3 w-2/3 rounded-md bg-primary-100/50" />
          </div>

          {/* Skeleton: meta */}
          <div className="flex items-center gap-4 pt-1">
            <div className="h-3 w-16 rounded-md bg-primary-100/40" />
            <div className="h-3 w-16 rounded-md bg-primary-100/40" />
          </div>
        </div>
      </Card>
    </div>
  );
}
