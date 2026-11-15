import { useEffect, useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent, useRealtimeFallbackInterval } from "@/core/realtime/useRealtime";
import {
  fetchActiveEvents,
  fetchBlockCounters,
  fetchInstallation,
  fetchLogs,
  fetchPanel,
  type LogType,
} from "./fireApi";

export const fireKeys = {
  all: ["cie"] as const,
  panel: ["cie", "panel"] as const,
  active: ["cie", "active"] as const,
  blocks: ["cie", "blocks"] as const,
  installation: ["cie-installation"] as const,
  logs: (type: LogType, onlyOccurrences: boolean) => ["cie", "logs", type, onlyOccurrences] as const,
};

const FALLBACK_REFRESH_MS = 10_000;
// Eventos chegam em rajada num alarme (status, ativos, log): uma recarga só.
const INVALIDATE_DEBOUNCE_MS = 500;

export function usePanel() {
  const refetchInterval = useRealtimeFallbackInterval(FALLBACK_REFRESH_MS);
  return useQuery({ queryKey: fireKeys.panel, queryFn: ({ signal }) => fetchPanel(signal), refetchInterval });
}

export function useActiveEvents() {
  const refetchInterval = useRealtimeFallbackInterval(FALLBACK_REFRESH_MS);
  return useQuery({ queryKey: fireKeys.active, queryFn: ({ signal }) => fetchActiveEvents(signal), refetchInterval });
}

export function useBlockCounters(enabled: boolean) {
  return useQuery({ queryKey: fireKeys.blocks, queryFn: ({ signal }) => fetchBlockCounters(signal), enabled });
}

/** Cadastro da central: muda só quando a programação é reenviada. */
export function useInstallation() {
  return useQuery({
    queryKey: fireKeys.installation,
    queryFn: ({ signal }) => fetchInstallation(signal),
    staleTime: Infinity,
  });
}

export function useLogs(type: LogType, onlyOccurrences: boolean) {
  return useInfiniteQuery({
    queryKey: fireKeys.logs(type, onlyOccurrences),
    queryFn: ({ pageParam, signal }) => fetchLogs({ type, onlyOccurrences, cursor: pageParam }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

const CIE_EVENTS = [
  "cie.status.updated",
  "cie.alarm.triggered",
  "cie.failure.triggered",
  "cie.log.received",
  "cie.active.updated",
  "cie.connection.changed",
] as const;

/**
 * Qualquer evento da central recarrega painel, ativos e histórico (não o
 * cadastro). Recarregar pela REST em vez de aplicar cada evento mantém a
 * tela igual ao que a API interpreta, sem duplicar essa lógica aqui.
 */
export function useFireRealtime() {
  const queryClient = useQueryClient();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const schedule = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: fireKeys.all });
    }, INVALIDATE_DEBOUNCE_MS);
  };

  // Um hook por evento: a lista é fixa, então a ordem dos hooks não muda.
  useRealtimeEvent(CIE_EVENTS[0], schedule);
  useRealtimeEvent(CIE_EVENTS[1], schedule);
  useRealtimeEvent(CIE_EVENTS[2], schedule);
  useRealtimeEvent(CIE_EVENTS[3], schedule);
  useRealtimeEvent(CIE_EVENTS[4], schedule);
  useRealtimeEvent(CIE_EVENTS[5], schedule);
}
