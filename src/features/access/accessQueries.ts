import { useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent } from "@/core/realtime/useRealtime";
import { gatesListQuery, type Gate } from "@/features/gates/gatesApi";
import { erpDateTimeKey } from "./accessFormat";
import { fetchRecentAccess, type AccessRecentRow } from "./accessApi";

const RECENT_PER_GATE = 20;
const RECENT_SHOWN = 30;
// A passagem é gravada pelo TAG segundos depois de o portão fechar, sem
// evento próprio: por isso as últimas passagens são consultadas
// periodicamente mesmo com o tempo real conectado.
const RECENT_REFRESH_MS = 15_000;
const LIVE_READS_KEPT = 15;

const recentKey = (numeroDispositivo: number) => ["access", "recent", numeroDispositivo] as const;

export function useActiveGates() {
  const query = useQuery(gatesListQuery);
  const gates = (query.data ?? []).filter((gate) => gate.ativo);
  return { gates, query };
}

export interface RecentAccess extends AccessRecentRow {
  key: string;
  gateName: string;
}

/** Últimas passagens dos portões informados, juntas e da mais recente para a mais antiga. */
export function useRecentAccess(gates: Gate[]) {
  const results = useQueries({
    queries: gates.map((gate) => ({
      queryKey: recentKey(gate.numeroDispositivo),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchRecentAccess(gate.numeroDispositivo, RECENT_PER_GATE, signal),
      refetchInterval: RECENT_REFRESH_MS,
    })),
  });

  const rows: RecentAccess[] = results
    .flatMap((result, index) => {
      const gate = gates[index];
      if (!gate) return [];
      return (result.data ?? []).map((row, position) => ({
        ...row,
        gateName: gate.nome,
        key: `${gate.numeroDispositivo}-${row.DATAHORA ?? ""}-${row.IDACESSO ?? ""}-${position}`,
      }));
    })
    .sort((a, b) => erpDateTimeKey(b.DATAHORA).localeCompare(erpDateTimeKey(a.DATAHORA)))
    .slice(0, RECENT_SHOWN);

  return {
    rows,
    isPending: results.some((result) => result.isPending),
    failedGates: gates.filter((_gate, index) => results[index]?.isError).map((gate) => gate.nome),
    refetch: () => results.forEach((result) => void result.refetch()),
  };
}

export interface LiveRead {
  id: number;
  receivedAt: Date;
  numeroDispositivo: number;
  tag: string;
  authorized: boolean;
  reason: string | null;
}

interface TagReadEvent {
  numeroDispositivo: number;
  tag: string;
  authorized: boolean;
  reason: string | null;
}

/**
 * Leituras de TAG enquanto a tela está aberta, inclusive as recusadas (que
 * não viram passagem). Ficam só em memória. Cada leitura também antecipa a
 * consulta das últimas passagens daquele portão.
 */
export function useLiveTagReads(): LiveRead[] {
  const queryClient = useQueryClient();
  const [reads, setReads] = useState<LiveRead[]>([]);

  useRealtimeEvent<TagReadEvent>("tag.read", (event) => {
    setReads((current) =>
      [
        {
          id: (current[0]?.id ?? 0) + 1,
          receivedAt: new Date(),
          numeroDispositivo: event.numeroDispositivo,
          tag: String(event.tag ?? ""),
          authorized: event.authorized === true,
          reason: typeof event.reason === "string" ? event.reason : null,
        },
        ...current,
      ].slice(0, LIVE_READS_KEPT),
    );
    void queryClient.invalidateQueries({ queryKey: recentKey(event.numeroDispositivo) });
  });

  return reads;
}
