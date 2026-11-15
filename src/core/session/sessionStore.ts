import { ApiError, sendRequest } from "@/core/api/http";
import type { components } from "@/core/api/schema.gen";

export type SessionData = components["schemas"]["SessionData"];
export type SessionUser = components["schemas"]["SessionUser"];

export interface Session {
  accessToken: string;
  refreshToken: string;
  /**
   * Quando o access token expira, em epoch ms do relógio DESTA máquina
   * (recebimento + expiresIn). O `expiresAt` do servidor não é usado: um
   * computador com a hora errada renovaria o token a cada requisição, ou nunca.
   */
  accessExpiresAt: number;
  user: SessionUser;
}

const STORAGE_KEY = "nova-residence-v3-session";
const REFRESH_LOCK = "nova-residence-v3-session-refresh";
// Renova um pouco antes de expirar para a requisição não chegar vencida.
const EXPIRY_MARGIN_MS = 60_000;

const parseSession = (raw: string | null): Session | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Session> | null;
    const valid =
      typeof value?.accessToken === "string" &&
      typeof value.refreshToken === "string" &&
      typeof value.accessExpiresAt === "number" &&
      typeof value.user?.id === "string";
    return valid ? (value as Session) : null;
  } catch {
    // Conteúdo corrompido ou escrito por outra versão: vale como sem sessão.
    return null;
  }
};

// localStorage pode estar bloqueado (modo privado, política do navegador).
// Nesse caso a sessão vive só na memória desta aba e some ao recarregar.
const readStorage = (): string | null | undefined => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return undefined;
  }
};

const writeStorage = (session: Session | null) => {
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sem armazenamento: a sessão segue só em memória (ver readStorage).
  }
};

let current: Session | null = parseSession(readStorage() ?? null);
const listeners = new Set<() => void>();

const setCurrent = (session: Session | null) => {
  current = session;
  for (const listener of listeners) listener();
};

/** O que está gravado agora — pode ter sido alterado por outra aba. */
const readPersisted = (): Session | null => {
  const raw = readStorage();
  return raw === undefined ? current : parseSession(raw);
};

// Login, logout e renovação feitos em outra aba chegam por aqui.
window.addEventListener("storage", (event) => {
  if (event.key === STORAGE_KEY || event.key === null) setCurrent(parseSession(readStorage() ?? null));
});

export const getSession = (): Session | null => current;

export const subscribeSession = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Guarda a sessão devolvida por login, refresh ou troca/recuperação de senha. */
export function startSession(data: SessionData): Session {
  const session: Session = {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    accessExpiresAt: Date.now() + data.expiresIn * 1000,
    user: data.user,
  };
  writeStorage(session);
  setCurrent(session);
  return session;
}

/** Atualiza os dados do usuário (papel, pendências) sem mexer nos tokens. */
export function updateSessionUser(patch: Partial<SessionUser>) {
  if (!current) return;
  const session: Session = { ...current, user: { ...current.user, ...patch } };
  writeStorage(session);
  setCurrent(session);
}

export function endSession() {
  writeStorage(null);
  setCurrent(null);
}

// O refresh token é de uso único: duas renovações simultâneas invalidariam
// uma à outra. Dentro da aba, todas as chamadas compartilham uma promessa;
// entre abas, o Web Lock garante uma por vez. Sem Web Locks (navegador antigo
// ou página fora de contexto seguro) fica só a proteção dentro da aba.
const withRefreshLock = <T>(task: () => Promise<T>): Promise<T> =>
  navigator.locks ? navigator.locks.request(REFRESH_LOCK, task) : task();

let refreshInFlight: Promise<Session | null> | null = null;

/**
 * Renova a sessão. `staleAccessToken` é o token que o chamador considera
 * vencido: se a sessão atual já tem outro, alguém renovou antes e ela é
 * devolvida sem gastar o refresh token. Devolve null quando a sessão acabou.
 */
export function refreshSession(staleAccessToken = current?.accessToken): Promise<Session | null> {
  if (!current) return Promise.resolve(null);
  if (current.accessToken !== staleAccessToken) return Promise.resolve(current);

  refreshInFlight ??= withRefreshLock(async () => {
    // Enquanto esta aba esperava o lock, outra pode ter renovado ou saído.
    const persisted = readPersisted();
    if (!persisted) {
      setCurrent(null);
      return null;
    }
    if (persisted.accessToken !== staleAccessToken) {
      setCurrent(persisted);
      return persisted;
    }

    try {
      const data = await sendRequest<SessionData>("POST", "/auth/refresh", {
        body: { refreshToken: persisted.refreshToken },
      });
      return startSession(data);
    } catch (error) {
      // Só a recusa do servidor encerra a sessão. Falha de rede ou serviço
      // fora do ar é passageira: derrubar o operador por isso seria pior.
      if (error instanceof ApiError && (error.type === "unauthorized" || error.type === "validation-error")) {
        endSession();
        return null;
      }
      throw error;
    }
  }).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/** Access token válido para a próxima requisição, renovando se estiver no fim. */
export async function getFreshAccessToken(): Promise<string | null> {
  if (!current) return null;
  if (current.accessExpiresAt - Date.now() > EXPIRY_MARGIN_MS) return current.accessToken;
  return (await refreshSession())?.accessToken ?? null;
}
