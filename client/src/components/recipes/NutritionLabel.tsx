import type { Nutrition } from "../../../../shared/types.ts";
import { cn } from "../../lib/utils.ts";

type NutritionLabelProps = {
  nutrition: Nutrition;
  className?: string;
};

export default function NutritionLabel({
  nutrition,
  className,
}: NutritionLabelProps) {
  const macros = [
    { label: "Protein", value: nutrition.protein, unit: "g", color: "bg-blue-500" },
    { label: "Carbs", value: nutrition.carbs, unit: "g", color: "bg-amber-500" },
    { label: "Fat", value: nutrition.fat, unit: "g", color: "bg-red-500" },
    { label: "Fiber", value: nutrition.fiber, unit: "g", color: "bg-green-500" },
  ] as const;

  return (
    <div className={cn("rounded-lg bg-surface-50 p-3", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          Nutrition
        </span>
        <span className="text-lg font-bold text-text-primary">
          {nutrition.calories}{" "}
          <span className="text-xs font-normal text-text-muted">kcal</span>
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {macros.map((macro) => (
          <div key={macro.label} className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <div className={cn("h-2 w-2 rounded-full", macro.color)} />
              <span className="text-xs text-text-muted">{macro.label}</span>
            </div>
            <p className="text-sm font-semibold text-text-primary">
              {macro.value}
              {macro.unit}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
