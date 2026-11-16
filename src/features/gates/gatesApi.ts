import { queryOptions } from "@tanstack/react-query";
import { api } from "@/core/api/api";
import type { components } from "@/core/api/schema.gen";
import type { Sentido } from "@/features/access/accessApi";

// Portões (serviço TAG, por numeroDispositivo) e portas de pedestre.

export type Gate = components["schemas"]["Gate"];
export type GatesStatus = components["schemas"]["GatesStatusData"];
export type GateState = components["schemas"]["GateStateData"];
export type GateCommandResult = components["schemas"]["GateCommandData"];

export interface Door {
  id: number;
  nome: string;
  porta: number;
  ativo: boolean;
}

export interface DoorsStatus {
  updatedAt: string | null;
  doors: { id: number; nome: string; porta: number; online: boolean }[];
}

/** Tempo de fechamento automático aceito pela API. */
export const AUTO_CLOSE_MIN_SECONDS = 1;
export const AUTO_CLOSE_MAX_SECONDS = 120;

export const fetchGates = (signal?: AbortSignal) => api.get<Gate[]>("/tag/gates", { signal });

// Consultas compartilhadas com outras telas (Acessos, Equipamentos, Painel):
// mesma chave = mesmo cache, e a atualização pelo tempo real vale para todas.
export const gatesListQuery = queryOptions({
  queryKey: ["gates", "list"],
  queryFn: ({ signal }) => fetchGates(signal),
});
export const fetchGatesStatus = (signal?: AbortSignal) => api.get<GatesStatus>("/tag/status", { signal });
export const fetchGateState = (numeroDispositivo: number, signal?: AbortSignal) =>
  api.get<GateState>("/tag/gate/state", { query: { numeroDispositivo }, signal });

export const openGate = (numeroDispositivo: number, autoCloseTime: number) =>
  api.post<GateCommandResult>("/tag/gate/open", { numeroDispositivo, autoCloseTime });

/** Fica aberto até alguém fechar. Só síndico/admin. */
export const keepGateOpen = (numeroDispositivo: number) =>
  api.post<GateCommandResult>("/tag/gate/open", { numeroDispositivo, keepOpen: true });

export const closeGate = (numeroDispositivo: number) =>
  api.post<GateCommandResult>("/tag/gate/close", { numeroDispositivo });

/** Reinicia o serviço do portão; volta sozinho em segundos. Só síndico/admin. */
export const restartGate = (numeroDispositivo: number) =>
  api.post<{ message: string; shutdownDelayMs: number }>("/tag/gate/restart", { numeroDispositivo, confirm: true });

export const fetchDoors = (signal?: AbortSignal) => api.get<Door[]>("/doors", { signal });
export const fetchDoorsStatus = (signal?: AbortSignal) => api.get<DoorsStatus>("/doors/status", { signal });

export const gatesStatusQuery = queryOptions({
  queryKey: ["gates", "status"],
  queryFn: ({ signal }) => fetchGatesStatus(signal),
});
export const doorsListQuery = queryOptions({
  queryKey: ["doors", "list"],
  queryFn: ({ signal }) => fetchDoors(signal),
});
export const doorsStatusQuery = queryOptions({
  queryKey: ["doors", "status"],
  queryFn: ({ signal }) => fetchDoorsStatus(signal),
});
export const openDoor = (id: number) => api.post<{ id: number; nome: string; porta: number }>(`/doors/${id}/open`);

/** Sentido cadastrado do portão; qualquer coisa que não seja saída conta como entrada. */
export const gateSentido = (gate: Pick<Gate, "sentido">): Sentido =>
  gate.sentido.trim().toUpperCase() === "S" ? "S" : "E";

// Cache de TAGs de cada antena: as já conferidas ficam guardadas por um
// tempo (liberadas 5 min, recusadas 1 min) para o portão abrir sem
// consultar o ERP de novo. Tem dado de morador: nunca guardar no navegador.

export type TagCacheList = components["schemas"]["ListCacheData"];
export type TagCacheItem = components["schemas"]["TagCacheItem"];
export type TagCacheFilter = "all" | "positive" | "negative";

export const fetchTagCache = (numeroDispositivo: number, type: TagCacheFilter, signal?: AbortSignal) =>
  api.get<TagCacheList>("/tag/cache", { query: { numeroDispositivo, type }, signal });

/** Só síndico/admin. */
export const clearTagCache = (numeroDispositivo: number, type: TagCacheFilter) =>
  api.delete<{ type: TagCacheFilter; stats: TagCacheList["stats"] }>("/tag/cache", undefined, { query: { numeroDispositivo, type } });

/** Só síndico/admin: a próxima leitura dessa TAG volta a consultar o ERP. */
export const removeTagFromCache = (numeroDispositivo: number, tag: string) =>
  api.delete<{ tag: string }>(`/tag/cache/${encodeURIComponent(tag)}`, undefined, { query: { numeroDispositivo } });
