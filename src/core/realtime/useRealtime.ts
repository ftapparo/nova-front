import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/core/session/useSession";
import { realtime, type RealtimeStatus } from "./realtime";

/**
 * Mantém o tempo real ligado enquanto houver sessão. A cada conexão aberta,
 * recarrega as consultas visíveis: eventos são deltas, e os que chegaram
 * enquanto o socket estava fora se perderam.
 */
export function useRealtimeConnection() {
  const queryClient = useQueryClient();
  const userId = useSession()?.user.id;

  useEffect(() => {
    if (!userId) return;
    realtime.start(() => void queryClient.invalidateQueries({ refetchType: "active" }));
    return () => realtime.stop();
  }, [userId, queryClient]);
}

export function useRealtimeStatus(): RealtimeStatus {
  return useSyncExternalStore(realtime.subscribeStatus, realtime.getStatus);
}

/**
 * Chama `handler` a cada evento. O `data` vem do servidor sem validação de
 * formato: trate como o mesmo formato da rota REST correspondente.
 */
export function useRealtimeEvent<T>(event: string, handler: (data: T) => void) {
  const onEvent = useEffectEvent((data: unknown) => handler(data as T));
  useEffect(() => realtime.subscribe(event, onEvent), [event]);
}

/**
 * `refetchInterval` para consultas que dependem de eventos: sem polling com o
 * tempo real conectado, `intervalMs` enquanto ele estiver fora.
 */
export function useRealtimeFallbackInterval(intervalMs: number): number | false {
  return useRealtimeStatus().state === "open" ? false : intervalMs;
}
