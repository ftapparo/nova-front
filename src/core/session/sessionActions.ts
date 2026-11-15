import { api } from "@/core/api/api";
import { sendRequest } from "@/core/api/http";
import {
  endSession,
  getSession,
  startSession,
  updateSessionUser,
  type Session,
  type SessionData,
  type SessionUser,
} from "./sessionStore";

export async function signIn(email: string, password: string): Promise<Session> {
  const data = await sendRequest<SessionData>("POST", "/auth/login", { body: { email, password } });
  return startSession(data);
}

export async function signOut(): Promise<void> {
  try {
    if (getSession()) await api.post("/auth/logout");
  } catch {
    // O logout no servidor só revoga o refresh token. Se a chamada falhar, a
    // sessão local sai do mesmo jeito: quem clicou em "Sair" não pode
    // continuar logado por causa de um erro de rede.
  } finally {
    endSession();
  }
}

/** Relê papel e pendências da conta no servidor (podem ter mudado desde o login). */
export async function reloadSessionUser(): Promise<void> {
  const user = await api.get<SessionUser>("/auth/me");
  updateSessionUser(user);
}
