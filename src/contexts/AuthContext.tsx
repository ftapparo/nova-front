import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { syncUserSettingsOnLogin } from "@/services/user-settings-sync";
import { ensurePushSubscription, removePushSubscription } from "@/services/web-push";

interface AuthContextType {
  isAuthenticated: boolean;
  user: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const VALID_USER = "portaria";
const VALID_PASS = "1793";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem("nr_auth") === "true");
  const [user, setUser] = useState<string | null>(() => sessionStorage.getItem("nr_user"));

  const login = useCallback(async (username: string, password: string) => {
    if (username === VALID_USER && password === VALID_PASS) {
      const normalizedUser = username.toUpperCase();
      await syncUserSettingsOnLogin(normalizedUser);
      await ensurePushSubscription(normalizedUser);
      setIsAuthenticated(true);
      setUser(normalizedUser);
      sessionStorage.setItem("nr_auth", "true");
      sessionStorage.setItem("nr_user", normalizedUser);
      return { success: true };
    }
    return { success: false, error: "Usuário ou senha inválidos." };
  }, []);

  const logout = useCallback(async () => {
    const currentUser = user;
    if (currentUser) {
      await removePushSubscription(currentUser);
    }

    setIsAuthenticated(false);
    setUser(null);
    sessionStorage.removeItem("nr_auth");
    sessionStorage.removeItem("nr_user");
  }, [user]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
