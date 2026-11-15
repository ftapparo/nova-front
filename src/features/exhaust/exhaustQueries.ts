import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent, useRealtimeFallbackInterval } from "@/core/realtime/useRealtime";
import { fetchExhausts, type Exhaust } from "./exhaustApi";

export const exhaustKeys = { list: ["exhausts"] as const };

const FALLBACK_REFRESH_MS = 15_000;

export function useExhausts() {
  const refetchInterval = useRealtimeFallbackInterval(FALLBACK_REFRESH_MS);
  return useQuery({
    queryKey: exhaustKeys.list,
    queryFn: ({ signal }) => fetchExhausts(signal),
    refetchInterval,
  });
}

/** Troca um exaustor da lista pelo estado novo (resposta de comando ou evento). */
export function useApplyExhaust() {
  const queryClient = useQueryClient();
  return (updated: Exhaust) =>
    queryClient.setQueryData<Exhaust[]>(exhaustKeys.list, (current) =>
      current?.map((exhaust) => (exhaust.id === updated.id ? updated : exhaust)),
    );
}

export function useExhaustRealtime() {
  const apply = useApplyExhaust();
  useRealtimeEvent<Exhaust>("exhaust.changed", apply);
}

/** Hora atual, renovada a cada `intervalMs`, para contagens regressivas. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}
