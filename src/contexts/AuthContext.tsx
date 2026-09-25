import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { syncUserSettingsOnLogin } from "@/services/user-settings-sync";
import { ensurePushSubscription, removePushSubscription } from "@/services/web-push";

interface AuthContextType {
  isAuthenticated: boolean;
  user: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * ATENÇÃO — limitação conhecida desta implementação.
 *
 * Esta verificação roda no navegador, então NÃO é um controle de segurança:
 * qualquer pessoa com o DevTools aberto consegue contorná-la, e as credenciais
 * ficam no bundle publicado mesmo vindo de variável de ambiente.
 *
 * A proteção efetiva do painel hoje é o Cloudflare Access na borda, que
 * autentica antes de a aplicação carregar. Esta tela é apenas o seletor de
 * operador, usado para o cabeçalho x-user e a auditoria.
 *
 * Isto é substituído por autenticação real (POST /auth/login + JWT) na
 * Etapa 2 — ver PLANO-MELHORIAS-MOBILE.md, seções 8 e 16.
 */
const VALID_USER = import.meta.env.VITE_AUTH_USER || "portaria";
const VALID_PASS = import.meta.env.VITE_AUTH_PASS || "";
const AUTH_KEY = "nr_auth";
const USER_KEY = "nr_user";

const getStoredAuthState = () => {
  const localAuth = localStorage.getItem(AUTH_KEY) === "true";
  const localUser = localStorage.getItem(USER_KEY);
  if (localAuth && localUser) {
    return { isAuthenticated: true, user: localUser };
  }

  const sessionAuth = sessionStorage.getItem(AUTH_KEY) === "true";
  const sessionUser = sessionStorage.getItem(USER_KEY);
  if (sessionAuth && sessionUser) {
    return { isAuthenticated: true, user: sessionUser };
  }

  return { isAuthenticated: false, user: null as string | null };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => getStoredAuthState().isAuthenticated);
  const [user, setUser] = useState<string | null>(() => getStoredAuthState().user);

  const login = useCallback(async (username: string, password: string, rememberMe = false) => {
    if (!VALID_PASS) {
      return {
        success: false,
        error: "Aplicação sem credencial configurada. Defina VITE_AUTH_PASS no build.",
      };
    }

    if (username === VALID_USER && password === VALID_PASS) {
      const normalizedUser = username.toUpperCase();
      await syncUserSettingsOnLogin(normalizedUser);
      await ensurePushSubscription(normalizedUser);
      setIsAuthenticated(true);
      setUser(normalizedUser);

      const targetStorage = rememberMe ? localStorage : sessionStorage;
      const otherStorage = rememberMe ? sessionStorage : localStorage;

      targetStorage.setItem(AUTH_KEY, "true");
      targetStorage.setItem(USER_KEY, normalizedUser);
      otherStorage.removeItem(AUTH_KEY);
      otherStorage.removeItem(USER_KEY);

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
    sessionStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(USER_KEY);
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
