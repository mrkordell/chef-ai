import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth.tsx";
import AuthGuard from "./components/layout/AuthGuard.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import RegisterPage from "./pages/RegisterPage.tsx";
import ChatPage from "./pages/ChatPage.tsx";
import RecipesPage from "./pages/RecipesPage.tsx";
import MealPlanPage from "./pages/MealPlanPage.tsx";
import PreferencesPage from "./pages/PreferencesPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <AuthGuard>
                <ChatPage />
              </AuthGuard>
            }
          />
          <Route
            path="/chat"
            element={
              <AuthGuard>
                <ChatPage />
              </AuthGuard>
            }
          />
          <Route
            path="/recipes"
            element={
              <AuthGuard>
                <RecipesPage />
              </AuthGuard>
            }
          />
          <Route
            path="/meal-plans"
            element={
              <AuthGuard>
                <MealPlanPage />
              </AuthGuard>
            }
          />
          <Route
            path="/preferences"
            element={
              <AuthGuard>
                <PreferencesPage />
              </AuthGuard>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
