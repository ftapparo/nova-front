import { api } from "@/core/api/api";
import { sendRequest } from "@/core/api/http";
import type { SessionData } from "@/core/session/sessionStore";

export const changePassword = (currentPassword: string, newPassword: string) =>
  // Aqui 401 significa "senha atual incorreta", não sessão vencida.
  api.post<SessionData>("/auth/password/change", { currentPassword, newPassword }, { noRefreshOn401: true });

/** Responde 202 sempre, exista ou não conta com o e-mail. */
export const requestPasswordRecovery = (email: string) =>
  sendRequest<null>("POST", "/auth/password/recover", { body: { email } });

export const confirmPasswordRecovery = (input: { email: string; code: string; newPassword: string }) =>
  sendRequest<SessionData>("POST", "/auth/password/recover/confirm", { body: input });
