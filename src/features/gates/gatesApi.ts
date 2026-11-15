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
export const openDoor = (id: number) => api.post<{ id: number; nome: string; porta: number }>(`/doors/${id}/open`);

/** Sentido cadastrado do portão; qualquer coisa que não seja saída conta como entrada. */
export const gateSentido = (gate: Pick<Gate, "sentido">): Sentido =>
  gate.sentido.trim().toUpperCase() === "S" ? "S" : "E";
