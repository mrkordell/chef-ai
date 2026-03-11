import { useEffect } from "react";
import { useChat } from "../hooks/useChat.ts";
import Sidebar from "../components/layout/Sidebar.tsx";
import ChatWindow from "../components/chat/ChatWindow.tsx";

export default function ChatPage() {
  const {
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
  } = useChat();

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={loadConversation}
        onNewConversation={newConversation}
        onDeleteConversation={deleteConversation}
      />

      <main className="flex-1 min-w-0">
        <ChatWindow
          messages={messages}
          isStreaming={isStreaming}
          currentStreamContent={currentStreamContent}
          onSend={sendMessage}
        />
      </main>
    </div>
  );
}
