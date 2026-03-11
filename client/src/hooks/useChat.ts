import { useCallback, useRef, useState } from "react";
import type { ChatMessage, Conversation, Recipe, ToolCallEvent } from "../../../shared/types.ts";
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
  currentToolCalls: ToolCallEvent[];
  pendingToolCalls: Array<{ name: string; index: number }>;
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
  const [currentToolCalls, setCurrentToolCalls] = useState<ToolCallEvent[]>([]);
  const [pendingToolCalls, setPendingToolCalls] = useState<Array<{ name: string; index: number }>>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);

  // Track the conversation ID ref so SSE callback can read the latest value
  const conversationIdRef = useRef<number | null>(null);
  conversationIdRef.current = activeConversationId;

  const toolCallsRef = useRef<ToolCallEvent[]>([]);

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
    setCurrentToolCalls([]);
    toolCallsRef.current = [];
  }, []);

  const deleteConversation = useCallback(
    async (id: number) => {
      await apiDeleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));

      if (conversationIdRef.current === id) {
        setActiveConversationId(null);
        setMessages([]);
        setCurrentStreamContent("");
        setCurrentToolCalls([]);
        toolCallsRef.current = [];
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
      setCurrentToolCalls([]);
      setPendingToolCalls([]);
      toolCallsRef.current = [];

      let accumulated = "";

      await apiSendMessage(
        text.trim(),
        conversationIdRef.current,
        {
          onContent(content: string) {
            accumulated += content;
            setCurrentStreamContent(accumulated);
          },

          onToolCallStart(info) {
            setPendingToolCalls(prev => [...prev, info]);
          },

          onToolCall(toolCall) {
            const event: ToolCallEvent = {
              name: toolCall.name as ToolCallEvent["name"],
              call_id: toolCall.call_id,
              data: toolCall.data as ToolCallEvent["data"],
            };
            toolCallsRef.current = [...toolCallsRef.current, event];
            setCurrentToolCalls([...toolCallsRef.current]);
          },

          onDone(data) {
            const finalToolCalls = toolCallsRef.current;
            const recipeToolCall = finalToolCalls.find(
              (tc) => tc.name === "save_recipe",
            );

            const assistantMessage: ChatMessage = {
              id: data.messageId,
              role: "assistant",
              content: accumulated,
              recipeData: recipeToolCall
                ? (recipeToolCall.data as Recipe)
                : null,
              toolCalls:
                finalToolCalls.length > 0 ? finalToolCalls : undefined,
              createdAt: Date.now(),
            };

            setMessages((prev) => [...prev, assistantMessage]);
            setCurrentStreamContent("");
            setCurrentToolCalls([]);
            setPendingToolCalls([]);
            toolCallsRef.current = [];
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
            setCurrentToolCalls([]);
            setPendingToolCalls([]);
            toolCallsRef.current = [];
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
    currentToolCalls,
    pendingToolCalls,
    conversations,
    activeConversationId,
    sendMessage,
    loadConversation,
    loadConversations,
    newConversation,
    deleteConversation,
  };
}
