import { useCallback, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  ChefHat,
  LogOut,
  Menu,
  MessageSquarePlus,
  Settings,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import type { Conversation } from "../../../../shared/types.ts";
import { useAuth } from "../../hooks/useAuth.tsx";
import { cn, formatDate } from "../../lib/utils.ts";
import { Avatar, AvatarFallback } from "../ui/avatar.tsx";
import { Button } from "../ui/button.tsx";
import { ScrollArea } from "../ui/scroll-area.tsx";
import { Separator } from "../ui/separator.tsx";

type SidebarProps = {
  conversations: Conversation[];
  activeConversationId: number | null;
  onSelectConversation: (id: number) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: number) => void;
};

export default function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const handleNewChat = useCallback(() => {
    onNewConversation();
    navigate("/chat");
    setMobileOpen(false);
  }, [onNewConversation, navigate]);

  const handleSelectConversation = useCallback(
    (id: number) => {
      onSelectConversation(id);
      navigate("/chat");
      setMobileOpen(false);
    },
    [onSelectConversation, navigate],
  );

  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const navLinks = [
    { to: "/recipes", icon: BookOpen, label: "Recipes" },
    { to: "/meal-plans", icon: Calendar, label: "Meal Plans" },
    { to: "/preferences", icon: Settings, label: "Preferences" },
  ] as const;

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-surface-200">
      {/* Branding */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-500 text-white">
          <ChefHat className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-text-primary">Chef AI</h1>
          <p className="text-xs text-text-muted">Kitchen Companion</p>
        </div>
      </div>

      <div className="px-3 pb-3">
        <Button
          onClick={handleNewChat}
          className="w-full justify-start gap-2"
          variant="outline"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <Separator />

      {/* Conversations list */}
      <ScrollArea className="flex-1 px-3 py-2">
        <div className="space-y-1">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={cn(
                "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                conversation.id === activeConversationId
                  ? "bg-primary-50 text-primary-700"
                  : "text-text-secondary hover:bg-surface-100 hover:text-text-primary",
              )}
              onClick={() => handleSelectConversation(conversation.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelectConversation(conversation.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-current={
                conversation.id === activeConversationId ? "true" : undefined
              }
            >
              <UtensilsCrossed className="h-4 w-4 shrink-0 opacity-50" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{conversation.title}</p>
                <p className="text-xs text-text-muted">
                  {formatDate(conversation.createdAt)}
                </p>
              </div>
              <button
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-danger-500/10 hover:text-danger-600 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(conversation.id);
                }}
                aria-label={`Delete conversation: ${conversation.title}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {conversations.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-text-muted">
              No conversations yet.
              <br />
              Start chatting with Chef AI!
            </p>
          )}
        </div>
      </ScrollArea>

      <Separator />

      {/* Navigation links */}
      <nav className="px-3 py-2 space-y-1" aria-label="Main navigation">
        {navLinks.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              location.pathname === to
                ? "bg-primary-50 text-primary-700"
                : "text-text-secondary hover:bg-surface-100 hover:text-text-primary",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <Separator />

      {/* User section */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{user?.name}</p>
          <p className="text-xs text-text-muted truncate">{user?.email}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          aria-label="Log out"
          className="h-8 w-8 shrink-0"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed top-3 left-3 z-50 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-md border border-surface-200 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[280px] transform transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-[280px] md:shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>
    </>
  );
}
