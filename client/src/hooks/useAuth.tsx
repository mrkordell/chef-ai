import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "../../../shared/types.ts";
import {
  clearToken,
  fetchMe,
  login as apiLogin,
  register as apiRegister,
  setToken,
} from "../lib/api.ts";

// ── Context shape ───────────────────────────────────────────────────

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (
    email: string,
    password: string,
    name: string,
  ) => Promise<string | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount — only if a token exists
  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("chef-ai-token");

    if (!token) {
      setIsLoading(false);
      return;
    }

    async function checkAuth() {
      try {
        const result = await fetchMe();
        if (!cancelled && result.success && result.data) {
          setUser(result.data);
        }
      } catch {
        // Token invalid or network error — stay logged out
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    checkAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      const result = await apiLogin(email, password);

      if (result.success && result.data) {
        setToken(result.data.token);
        setUser(result.data.user);
        return null;
      }

      return result.error ?? "Login failed";
    },
    [],
  );

  const register = useCallback(
    async (
      email: string,
      password: string,
      name: string,
    ): Promise<string | null> => {
      const result = await apiRegister(email, password, name);

      if (result.success && result.data) {
        setToken(result.data.token);
        setUser(result.data.user);
        return null;
      }

      return result.error ?? "Registration failed";
    },
    [],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    // Navigation handled by the component calling logout
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
