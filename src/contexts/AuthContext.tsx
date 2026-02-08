import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  user: string | null;
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const VALID_USER = "portaria";
const VALID_PASS = "1793";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => sessionStorage.getItem("nr_auth") === "true");
  const [user, setUser] = useState<string | null>(() => sessionStorage.getItem("nr_user"));

  const login = useCallback((username: string, password: string) => {
    if (username === VALID_USER && password === VALID_PASS) {
      setIsAuthenticated(true);
      setUser(username.toUpperCase());
      sessionStorage.setItem("nr_auth", "true");
      sessionStorage.setItem("nr_user", username.toUpperCase());
      return { success: true };
    }
    return { success: false, error: "Usuário ou senha inválidos." };
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    sessionStorage.removeItem("nr_auth");
    sessionStorage.removeItem("nr_user");
  }, []);

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
