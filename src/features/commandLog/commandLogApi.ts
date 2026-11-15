import { queryOptions } from "@tanstack/react-query";
import { api } from "@/core/api/api";

// Histórico de comandos em equipamento, do painel anterior (v2) e do novo
// (v3) e do app: o mesmo registro serve aos dois enquanto convivem.

// Escrito à mão: no openapi.json os campos aparecem como opcionais, mas a
// API sempre envia todos (APP-GUIDE §5.8). O evento command.logged vem sem `ip`.
export interface CommandLog {
  id: string;
  timestamp: string;
  requestId: string | null;
  method: string;
  path: string;
  command: string;
  status: number;
  actor: string;
  ip?: string | null;
}

export const COMMAND_LOG_LIMITS = [50, 100, 200] as const;

export const fetchCommandLogs = (limit: number, signal?: AbortSignal) =>
  api.get<CommandLog[]>("/commands/logs", { query: { limit }, signal });

/** Compartilhada com o Painel Operacional (mesmo cache dos últimos 50). */
export const commandLogsQuery = (limit: number) =>
  queryOptions({
    queryKey: ["commands", "logs", limit],
    queryFn: ({ signal }) => fetchCommandLogs(limit, signal),
  });

const CIE_ACTIONS: Record<string, string> = {
  silence: "Central silenciada",
  release: "Central liberada",
  "release-bip": "Bip da central reativado",
  "release-siren": "Sirenes reativadas",
  "silence-bip": "Bip da central silenciado",
  "silence-siren": "Sirenes silenciadas",
  "brigade-siren": "Sirene de brigada acionada",
  "alarm-general": "Alarme geral disparado",
  "delay-siren": "Retardo de sirene",
  restart: "Central reiniciada",
  block: "Bloqueio na central",
  output: "Saída da central acionada",
};

// Ordem importa: o primeiro padrão que casa decide. Cobre os caminhos da v2
// (/control/..., /exhausts/on) e da v3 (/tag/gate/..., /exhausts/A4/on).
const ACTIONS: [RegExp, string][] = [
  [/\/doors?\/(\d+\/)?open$/, "Porta aberta"],
  [/\/gate\/open$/, "Portão aberto"],
  [/\/gate\/close$/, "Portão fechado"],
  [/\/gate\/restart$/, "Serviço do portão reiniciado"],
  [/\/exhausts\/modules\/[^/]+\/config$/, "Módulo de exaustores configurado"],
  [/\/exhausts\/[^/]+\/maintenance$/, "Manutenção de exaustor"],
  [/\/exhausts\/([^/]+\/)?on$/, "Exaustor ligado"],
  [/\/exhausts\/([^/]+\/)?off$/, "Exaustor desligado"],
  [/\/access\/register$/, "Passagem registrada"],
  [/\/tag\/cache/, "Cache de TAGs alterado"],
];

const pathOf = (log: CommandLog) => (log.path || log.command || "").split("?")[0]!.toLowerCase();

/** Ação em português a partir do caminho da rota. */
export function commandLabel(log: CommandLog): string {
  const path = pathOf(log);
  const cie = /\/cie\/commands\/([^/]+)$/.exec(path);
  if (cie) return CIE_ACTIONS[cie[1]!] ?? "Comando na central de incêndio";
  for (const [pattern, label] of ACTIONS) if (pattern.test(path)) return label;
  if (log.method === "DELETE") return "Remoção";
  if (log.method === "PUT" || log.method === "PATCH") return "Alteração";
  return "Comando";
}

/** Equipamento envolvido, quando o caminho diz: "A4", "porta 3", "portão 9". */
export function commandTarget(log: CommandLog): string | null {
  const path = pathOf(log);
  const exhaust = /\/exhausts\/([a-z]+\d+)\//.exec(path);
  if (exhaust) return `Exaustor ${exhaust[1]!.toUpperCase()}`;
  const door = /\/doors\/(\d+)\//.exec(path);
  if (door) return `Porta ${door[1]}`;
  return null;
}

export const commandSucceeded = (log: CommandLog) => log.status >= 200 && log.status < 300;

/** Quem enviou: e-mail da conta (v3), operador (v2) ou serviço. */
export const commandActor = (log: CommandLog) => {
  const actor = (log.actor || "").trim();
  return !actor || actor.toLowerCase() === "desconhecido" ? "Não identificado" : actor;
};
