import { Navigate } from "react-router-dom";
import { ChefHat, Loader2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth.tsx";

type AuthGuardProps = {
  children: React.ReactNode;
};

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-surface-50">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500 text-white">
          <ChefHat className="h-8 w-8" />
        </div>
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
        <p className="text-sm text-text-muted">Loading Chef AI...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
