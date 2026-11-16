import { queryOptions } from "@tanstack/react-query";
import { api } from "@/core/api/api";
import type { components } from "@/core/api/schema.gen";

// Exaustores de churrasqueira, um por prumada: id = torre + final do
// apartamento (A-124 → "A4"). A equipe vê e opera os 24; a lista já vem
// filtrada pelo servidor, o painel não calcula acesso.

export type Exhaust = components["schemas"]["Exhaust"];

/** Mesmo padrão e mínimo do painel anterior. */
export const DEFAULT_MINUTES = 180;
export const MIN_MINUTES = 30;
/** Teto aceito pela API (24 h). */
export const MAX_MINUTES = 1440;

export const fetchExhausts = (signal?: AbortSignal) => api.get<Exhaust[]>("/exhausts", { signal });

/** Compartilhada com Equipamentos e Painel Operacional (mesmo cache). */
export const exhaustsQuery = queryOptions({
  queryKey: ["exhausts"],
  queryFn: ({ signal }) => fetchExhausts(signal),
});

/** Liga, ou reinicia o tempo se já estiver ligado. A equipe não envia localização. */
export const turnOnExhaust = (id: string, minutes: number) => api.post<Exhaust>(`/exhausts/${id}/on`, { minutes });

export const turnOffExhaust = (id: string) => api.post<Exhaust>(`/exhausts/${id}/off`);

/** Só síndico/admin. Em manutenção, ligar responde 409. */
export const setExhaustMaintenance = (id: string, maintenance: boolean) =>
  api.put<Exhaust>(`/exhausts/${id}/maintenance`, { maintenance });

export type ExhaustPhase = "on" | "off" | "turning-on" | "turning-off" | "error";

/** Situação para a tela, a partir do último comando e do estado do relé. */
export function exhaustPhase(exhaust: Exhaust): ExhaustPhase {
  if (exhaust.processStatus === "iniciando") return exhaust.command === "desligar" ? "turning-off" : "turning-on";
  if (exhaust.processStatus === "erro") return "error";
  return exhaust.on ? "on" : "off";
}

export const exhaustLabel = (exhaust: Pick<Exhaust, "tower" | "final">) => `Torre ${exhaust.tower} · final ${exhaust.final}`;

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** "Desliga às 21:30 (faltam 1 h 05 min)". */
export function remainingLabel(expiresAt: number, now: number): string {
  const totalMinutes = Math.max(0, Math.ceil((expiresAt - now) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const left = hours > 0 ? `${hours} h ${String(minutes).padStart(2, "0")} min` : `${minutes} min`;
  return `Desliga às ${timeFormat.format(expiresAt)} (faltam ${left})`;
}

// Módulos de exaustor: cada módulo da torre aciona os relés de quatro finais
// (1 a 4 ou 5 a 8). A API informa `moduleOnline` por exaustor; aqui se junta
// por módulo, que é o equipamento físico que fica fora do ar.

export interface ExhaustModule {
  id: string;
  label: string;
  online: boolean;
  exhaustIds: string[];
}

const moduleOf = (exhaust: Pick<Exhaust, "tower" | "final">) => {
  const group = exhaust.final <= 4 ? "14" : "58";
  return {
    id: `${exhaust.tower}_${group}`,
    label: `Torre ${exhaust.tower} · finais ${group === "14" ? "1 a 4" : "5 a 8"}`,
  };
};

export function groupExhaustModules(exhausts: Exhaust[]): ExhaustModule[] {
  const modules = new Map<string, ExhaustModule>();
  for (const exhaust of exhausts) {
    const { id, label } = moduleOf(exhaust);
    const current = modules.get(id) ?? { id, label, online: true, exhaustIds: [] };
    current.exhaustIds.push(exhaust.id);
    // Um exaustor sem comunicação basta para o módulo aparecer fora do ar.
    current.online = current.online && exhaust.moduleOnline;
    modules.set(id, current);
  }
  return [...modules.values()].sort((a, b) => a.id.localeCompare(b.id, "pt-BR"));
}

/** Módulos Tasmota aceitos pela API (relés dos exaustores e fontes). */
export const EXHAUST_MODULE_IDS = ["A_14", "A_58", "B_14", "B_58", "C_14", "C_58", "PWR_14", "PWR_58"] as const;
export type ExhaustModuleId = (typeof EXHAUST_MODULE_IDS)[number];

/**
 * Comando direto ao módulo (backlog do Tasmota, já codificado para URL).
 * Só admin. A resposta é a do próprio módulo, sem formato fixo.
 */
export const configureExhaustModule = (modulo: ExhaustModuleId, comando: string) =>
  api.post<unknown>(`/exhausts/modules/${modulo}/config`, { comando });
