import { useSyncExternalStore } from "react";
import { getSession, subscribeSession, type Session } from "./sessionStore";

/** Sessão atual (null = deslogado). Acompanha login/logout feitos em outra aba. */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribeSession, getSession);
}
