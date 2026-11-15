import { api } from "@/core/api/api";
import type { components } from "@/core/api/schema.gen";
import type { StaffRole } from "@/core/session/roles";

export type Account = components["schemas"]["AuthUser"] & { createdAt?: string };

export interface TemporaryPassword {
  accountId: string;
  email: string | null;
  temporaryPassword: string;
}

export const ACCOUNTS_PER_PAGE = 50;

export const listAccounts = (page: number, signal?: AbortSignal) =>
  api.get<Account[]>("/auth/users", { query: { page, perPage: ACCOUNTS_PER_PAGE }, signal });

export const createAccount = (input: { email: string; password: string; role: StaffRole }) =>
  api.post<Account>("/auth/users", input);

/** Gera uma senha provisória; a pessoa é obrigada a trocá-la no próximo login. */
export const resetAccountPassword = (accountId: string) =>
  api.post<TemporaryPassword>("/auth/password/staff-reset", { accountId });

/** `null` tira o papel: a conta volta a ser comum. */
export const updateAccountRole = (accountId: string, role: StaffRole | null) =>
  api.patch<Account>(`/auth/users/${accountId}`, { role });

export const deleteAccount = (accountId: string) => api.delete<null>(`/auth/users/${accountId}`, { confirm: true });
