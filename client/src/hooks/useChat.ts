import { useCallback, useRef, useState } from "react";
import type { ChatMessage, Conversation, Recipe } from "../../../shared/types.ts";
import {
  deleteConversation as apiDeleteConversation,
  fetchConversations,
  fetchMessages,
  sendMessage as apiSendMessage,
} from "../lib/api.ts";

type UseChatReturn = {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentStreamContent: string;
  conversations: Conversation[];
  activeConversationId: number | null;
  sendMessage: (text: string) => Promise<void>;
  loadConversation: (id: number) => Promise<void>;
  loadConversations: () => Promise<void>;
  newConversation: () => void;
  deleteConversation: (id: number) => Promise<void>;
};

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentStreamContent, setCurrentStreamContent] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);

  // Track the conversation ID ref so SSE callback can read the latest value
  const conversationIdRef = useRef<number | null>(null);
  conversationIdRef.current = activeConversationId;

  const loadConversations = useCallback(async () => {
    const result = await fetchConversations();
    if (result.success && result.data) {
      setConversations(result.data);
    }
  }, []);

  const loadConversation = useCallback(async (id: number) => {
    setActiveConversationId(id);
    setCurrentStreamContent("");

    const result = await fetchMessages(id);
    if (result.success && result.data) {
      setMessages(result.data);
    }
  }, []);

  const newConversation = useCallback(() => {
    setActiveConversationId(null);
    setMessages([]);
    setCurrentStreamContent("");
  }, []);

  const deleteConversation = useCallback(
    async (id: number) => {
      await apiDeleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));

      if (conversationIdRef.current === id) {
        setActiveConversationId(null);
        setMessages([]);
        setCurrentStreamContent("");
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      // Add user message optimistically
      const userMessage: ChatMessage = {
        role: "user",
        content: text.trim(),
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      setCurrentStreamContent("");

      let accumulated = "";

      await apiSendMessage(
        text.trim(),
        conversationIdRef.current,
        {
          onContent(content: string) {
            accumulated += content;
            setCurrentStreamContent(accumulated);
          },

          onDone(data) {
            const assistantMessage: ChatMessage = {
              id: data.messageId,
              role: "assistant",
              content: accumulated,
              recipeData:
                data.recipeData && data.recipeData.length > 0
                  ? data.recipeData[0]
                  : null,
              createdAt: Date.now(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
            setCurrentStreamContent("");
            setIsStreaming(false);

            // Update conversation ID if this was a new conversation
            if (data.conversationId) {
              setActiveConversationId(data.conversationId);
              // Refresh conversation list to include the new one
              loadConversations();
            }
          },

          onError(error: string) {
            const errorMessage: ChatMessage = {
              role: "assistant",
              content: `Sorry, something went wrong: ${error}. Please try again.`,
              createdAt: Date.now(),
            };

            setMessages((prev) => [...prev, errorMessage]);
            setCurrentStreamContent("");
            setIsStreaming(false);
          },
        },
      );
    },
    [isStreaming, loadConversations],
  );

  return {
    messages,
    isStreaming,
    currentStreamContent,
    conversations,
    activeConversationId,
    sendMessage,
    loadConversation,
    loadConversations,
    newConversation,
    deleteConversation,
  };
}
