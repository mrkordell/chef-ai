import { useCallback, useRef } from "react";
import type { KeyboardEvent } from "react";
import { ChefHat, SendHorizontal } from "lucide-react";
import { cn } from "../../lib/utils.ts";
import { Button } from "../ui/button.tsx";

type ChatInputProps = {
  onSend: (message: string) => void;
  isStreaming: boolean;
};

export default function ChatInput({ onSend, isStreaming }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const value = textarea.value.trim();
    if (!value || isStreaming) return;

    onSend(value);
    textarea.value = "";
    textarea.style.height = "auto";
  }, [onSend, isStreaming]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Auto-grow up to ~4 lines
    textarea.style.height = "auto";
    const maxHeight = 120; // ~4 lines
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, []);

  return (
    <div className="border-t border-surface-200 bg-white p-4">
      {isStreaming && (
        <div className="mb-3 flex items-center gap-2 text-sm text-primary-600">
          <ChefHat className="h-4 w-4 animate-[pulse-gentle_2s_ease-in-out_infinite]" />
          <span>Chef is cooking up a response...</span>
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          className={cn(
            "flex-1 resize-none rounded-xl border border-surface-300 bg-surface-50 px-4 py-3 text-sm text-text-primary placeholder:text-text-muted",
            "focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400",
            "transition-colors min-h-[44px]",
          )}
          placeholder="Ask Chef AI anything about cooking..."
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          rows={1}
          disabled={isStreaming}
          aria-label="Chat message input"
        />
        <Button
          onClick={handleSubmit}
          disabled={isStreaming}
          size="icon"
          className="h-11 w-11 shrink-0 rounded-xl"
          aria-label="Send message"
        >
          <SendHorizontal className="h-5 w-5" />
        </Button>
      </div>

      <p className="mt-2 text-center text-xs text-text-muted">
        Chef AI can make mistakes. Always verify cooking temperatures and allergy info.
      </p>
    </div>
  );
}
