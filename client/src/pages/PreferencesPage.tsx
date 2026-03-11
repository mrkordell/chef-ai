import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Check, Loader2, Settings, X } from "lucide-react";
import type { DietaryPreferences } from "../../../shared/types.ts";
import { fetchPreferences, updatePreferences } from "../lib/api.ts";
import { useChat } from "../hooks/useChat.ts";
import { cn } from "../lib/utils.ts";
import Sidebar from "../components/layout/Sidebar.tsx";
import { Button } from "../components/ui/button.tsx";
import { Input } from "../components/ui/input.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.tsx";
import { Badge } from "../components/ui/badge.tsx";
import { Separator } from "../components/ui/separator.tsx";

const DIET_OPTIONS = [
  { key: "vegetarian" as const, label: "Vegetarian" },
  { key: "vegan" as const, label: "Vegan" },
  { key: "glutenFree" as const, label: "Gluten-Free" },
  { key: "dairyFree" as const, label: "Dairy-Free" },
  { key: "keto" as const, label: "Keto" },
  { key: "paleo" as const, label: "Paleo" },
] as const;

const CUISINE_OPTIONS = [
  "Italian",
  "Mexican",
  "Chinese",
  "Japanese",
  "Indian",
  "Thai",
  "Mediterranean",
  "French",
  "Korean",
  "American",
  "Middle Eastern",
  "Vietnamese",
] as const;

const SKILL_LEVELS = [
  { value: "beginner" as const, label: "Beginner", description: "Simple recipes, basic techniques" },
  { value: "intermediate" as const, label: "Intermediate", description: "Comfortable with most techniques" },
  { value: "advanced" as const, label: "Advanced", description: "Complex recipes, advanced methods" },
] as const;

const DEFAULT_PREFERENCES: DietaryPreferences = {
  vegetarian: false,
  vegan: false,
  glutenFree: false,
  dairyFree: false,
  keto: false,
  paleo: false,
  allergies: [],
  cuisinePreferences: [],
  cookingSkill: "intermediate",
};

export default function PreferencesPage() {
  const {
    conversations,
    activeConversationId,
    loadConversation,
    loadConversations,
    newConversation,
    deleteConversation,
  } = useChat();

  const [preferences, setPreferences] =
    useState<DietaryPreferences>(DEFAULT_PREFERENCES);
  const [allergyInput, setAllergyInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const result = await fetchPreferences();
      if (result.success && result.data) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...result.data });
      }
      setIsLoading(false);
    }
    load();
  }, []);

  const toggleDiet = useCallback(
    (key: (typeof DIET_OPTIONS)[number]["key"]) => {
      setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [],
  );

  const toggleCuisine = useCallback((cuisine: string) => {
    setPreferences((prev) => {
      const current = prev.cuisinePreferences;
      const next = current.includes(cuisine)
        ? current.filter((c) => c !== cuisine)
        : [...current, cuisine];
      return { ...prev, cuisinePreferences: next };
    });
  }, []);

  const addAllergy = useCallback(() => {
    const value = allergyInput.trim();
    if (!value) return;

    setPreferences((prev) => {
      if (prev.allergies.includes(value)) return prev;
      return { ...prev, allergies: [...prev.allergies, value] };
    });
    setAllergyInput("");
  }, [allergyInput]);

  const removeAllergy = useCallback((allergy: string) => {
    setPreferences((prev) => ({
      ...prev,
      allergies: prev.allergies.filter((a) => a !== allergy),
    }));
  }, []);

  const setSkill = useCallback(
    (skill: DietaryPreferences["cookingSkill"]) => {
      setPreferences((prev) => ({ ...prev, cookingSkill: skill }));
    },
    [],
  );

  const handleSave = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      setSaveMessage(null);

      try {
        const result = await updatePreferences(preferences);
        if (result.success) {
          setSaveMessage("Preferences saved successfully!");
        } else {
          setSaveMessage(result.error ?? "Failed to save preferences");
        }
      } catch {
        setSaveMessage("An error occurred while saving");
      } finally {
        setIsSaving(false);
        setTimeout(() => setSaveMessage(null), 3000);
      }
    },
    [preferences],
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
        <div className="mx-auto max-w-2xl p-4 md:p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Settings className="h-6 w-6 text-primary-500" />
              Dietary Preferences
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Help Chef AI personalize recipes to your needs
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {/* Diet types */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Diet Types</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {DIET_OPTIONS.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleDiet(key)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                          preferences[key]
                            ? "border-healthy-500 bg-healthy-50 text-healthy-700"
                            : "border-surface-300 bg-white text-text-secondary hover:bg-surface-50",
                        )}
                        aria-pressed={!!preferences[key]}
                      >
                        <div
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded border",
                            preferences[key]
                              ? "border-healthy-500 bg-healthy-500 text-white"
                              : "border-surface-300",
                          )}
                        >
                          {preferences[key] && (
                            <Check className="h-3 w-3" />
                          )}
                        </div>
                        {label}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Allergies */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Allergies</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add an allergy (e.g., peanuts)"
                      value={allergyInput}
                      onChange={(e) => setAllergyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addAllergy();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addAllergy}
                    >
                      Add
                    </Button>
                  </div>

                  {preferences.allergies.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {preferences.allergies.map((allergy) => (
                        <Badge
                          key={allergy}
                          variant="destructive"
                          className="gap-1 pr-1"
                        >
                          {allergy}
                          <button
                            type="button"
                            onClick={() => removeAllergy(allergy)}
                            className="rounded-full p-0.5 hover:bg-danger-600/20"
                            aria-label={`Remove ${allergy} allergy`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cuisine preferences */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Cuisine Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {CUISINE_OPTIONS.map((cuisine) => {
                      const isSelected =
                        preferences.cuisinePreferences.includes(cuisine);
                      return (
                        <button
                          key={cuisine}
                          type="button"
                          onClick={() => toggleCuisine(cuisine)}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                            isSelected
                              ? "bg-primary-500 text-white"
                              : "bg-surface-100 text-text-secondary hover:bg-surface-200",
                          )}
                          aria-pressed={isSelected}
                        >
                          {cuisine}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Cooking skill */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Cooking Skill</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {SKILL_LEVELS.map(({ value, label, description }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSkill(value)}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                          preferences.cookingSkill === value
                            ? "border-primary-400 bg-primary-50"
                            : "border-surface-300 bg-white hover:bg-surface-50",
                        )}
                        role="radio"
                        aria-checked={preferences.cookingSkill === value}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                            preferences.cookingSkill === value
                              ? "border-primary-500"
                              : "border-surface-300",
                          )}
                        >
                          {preferences.cookingSkill === value && (
                            <div className="h-2 w-2 rounded-full bg-primary-500" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-primary">
                            {label}
                          </p>
                          <p className="text-xs text-text-muted">
                            {description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Save */}
              <div className="flex items-center gap-4">
                <Button type="submit" disabled={isSaving} className="gap-2">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Preferences"
                  )}
                </Button>

                {saveMessage && (
                  <p
                    className={cn(
                      "text-sm font-medium animate-[fade-in_0.3s_ease-out]",
                      saveMessage.includes("success")
                        ? "text-healthy-600"
                        : "text-danger-600",
                    )}
                    role="status"
                  >
                    {saveMessage}
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
