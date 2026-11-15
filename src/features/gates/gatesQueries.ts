import { useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRealtimeEvent, useRealtimeFallbackInterval } from "@/core/realtime/useRealtime";
import {
  doorsListQuery,
  doorsStatusQuery,
  fetchGateState,
  gatesListQuery,
  gatesStatusQuery,
  type Door,
  type DoorsStatus,
  type Gate,
  type GateState,
  type GatesStatus,
} from "./gatesApi";

export const gateKeys = {
  list: gatesListQuery.queryKey,
  status: gatesStatusQuery.queryKey,
  state: (numeroDispositivo: number) => ["gates", "state", numeroDispositivo] as const,
};

export const doorKeys = {
  list: doorsListQuery.queryKey,
  status: doorsStatusQuery.queryKey,
};

// Polling só enquanto o tempo real está fora. O status de online vem do
// monitoramento da API, que sonda os equipamentos a cada minuto.
const STATE_FALLBACK_MS = 10_000;
const STATUS_FALLBACK_MS = 60_000;

export interface GateView extends Gate {
  /** null = a API ainda não sondou o portão. */
  online: boolean | null;
}

export interface DoorView extends Door {
  online: boolean | null;
}

export function useGates() {
  const statusInterval = useRealtimeFallbackInterval(STATUS_FALLBACK_MS);
  const list = useQuery(gatesListQuery);
  const status = useQuery({ ...gatesStatusQuery, refetchInterval: statusInterval });

  const online = new Map(status.data?.gates.map((gate) => [gate.numeroDispositivo, gate.online]));
  const gates: GateView[] = (list.data ?? [])
    .filter((gate) => gate.ativo)
    .map((gate) => ({ ...gate, online: online.get(gate.numeroDispositivo) ?? null }));

  return { gates, list };
}

/** Estado de cada portão (fechado, abrindo...), indexado por numeroDispositivo. */
export function useGateStates(numerosDispositivo: number[]) {
  const interval = useRealtimeFallbackInterval(STATE_FALLBACK_MS);
  const results = useQueries({
    queries: numerosDispositivo.map((numero) => ({
      queryKey: gateKeys.state(numero),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchGateState(numero, signal),
      refetchInterval: interval,
      // Portão sem comunicação responde erro; a tela mostra "Desconhecido".
      retry: false,
    })),
  });
  return new Map(numerosDispositivo.map((numero, index) => [numero, results[index]]));
}

export function useDoors() {
  const statusInterval = useRealtimeFallbackInterval(STATUS_FALLBACK_MS);
  const list = useQuery(doorsListQuery);
  const status = useQuery({ ...doorsStatusQuery, refetchInterval: statusInterval });

  const online = new Map(status.data?.doors.map((door) => [door.id, door.online]));
  const doors: DoorView[] = (list.data ?? [])
    .filter((door) => door.ativo)
    .map((door) => ({ ...door, online: online.get(door.id) ?? null }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return { doors, list };
}

interface GateStateChanged {
  numeroDispositivo: number;
  state: GateState["state"];
  keepOpen?: boolean;
}

interface DevicesStatusChanged {
  updatedAt: string | null;
  gates?: { numeroDispositivo: number; online: boolean }[];
  doors?: { id: number; online: boolean }[];
}

/**
 * Aplica os eventos de portões e portas no cache das consultas acima.
 * Devolve as antenas que o servidor avisou estarem desconectadas: não há
 * rota REST para isso, então só se sabe a partir do primeiro aviso.
 */
export function useGatesRealtime(): ReadonlySet<number> {
  const queryClient = useQueryClient();
  const [antennasDown, setAntennasDown] = useState<ReadonlySet<number>>(new Set());

  useRealtimeEvent<{ numeroDispositivo: number; connected: boolean }>("antenna.connection.changed", (event) => {
    setAntennasDown((current) => {
      const next = new Set(current);
      if (event.connected) next.delete(event.numeroDispositivo);
      else next.add(event.numeroDispositivo);
      return next;
    });
  });

  useRealtimeEvent<GateStateChanged>("gate.state.changed", (event) => {
    queryClient.setQueryData<GateState>(gateKeys.state(event.numeroDispositivo), {
      state: event.state,
      keepOpen: event.keepOpen,
    });
  });

  // O evento traz só o que mudou: atualiza esses itens e mantém os demais.
  useRealtimeEvent<DevicesStatusChanged>("devices.status.changed", (event) => {
    const gateChanges = new Map(event.gates?.map((gate) => [gate.numeroDispositivo, gate.online]));
    const doorChanges = new Map(event.doors?.map((door) => [door.id, door.online]));

    if (gateChanges.size > 0) {
      queryClient.setQueryData<GatesStatus>(gateKeys.status, (current) =>
        current && {
          updatedAt: event.updatedAt ?? current.updatedAt,
          gates: current.gates.map((gate) => ({ ...gate, online: gateChanges.get(gate.numeroDispositivo) ?? gate.online })),
        },
      );
    }
    if (doorChanges.size > 0) {
      queryClient.setQueryData<DoorsStatus>(doorKeys.status, (current) =>
        current && {
          updatedAt: event.updatedAt ?? current.updatedAt,
          doors: current.doors.map((door) => ({ ...door, online: doorChanges.get(door.id) ?? door.online })),
        },
      );
    }
  });

  return antennasDown;
}
