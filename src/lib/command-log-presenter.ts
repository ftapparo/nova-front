import type { CommandLogItem } from "@/services/api";

const formatCommandLogDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", { hour12: false });
};

const normalizePath = (value: string): string => {
  return (value || "").split("?")[0].toLowerCase();
};

const normalizeActor = (value: string): string => {
  const actor = (value || "").trim();
  if (!actor || actor.toLowerCase() === "desconhecido") return "Operador";
  return actor;
};

const getActionLabel = (item: CommandLogItem): string => {
  const path = normalizePath(item.path || item.command);

  if (path.includes("/control/door/open")) return "Porta acionada";
  if (path.includes("/control/gate/open")) return "Portão acionado";
  if (path.includes("/control/gate/restart")) return "Portão reiniciado";
  if (path.includes("/exhausts/on")) return "Exaustor ligado";
  if (path.includes("/exhausts/off")) return "Exaustor desligado";
  if (path.includes("/access/register")) return "Acesso registrado";
  if (path.includes("/access/verify")) return "Validação de acesso";
  if (path.includes("/user-settings/")) return "Configuração do painel atualizada";

  if (item.method === "DELETE") return "Remoção de registro";
  if (item.method === "PUT" || item.method === "PATCH") return "Atualização de registro";
  return "Ação do sistema";
};

const getStatusLabel = (status: number): string => {
  if (status >= 200 && status < 300) return "Concluído";
  return "Falhou";
};

export const formatLastActionFromCommandLog = (entry: CommandLogItem | null): string | null => {
  if (!entry) return null;
  const action = getActionLabel(entry);
  const status = getStatusLabel(entry.status);
  const when = formatCommandLogDate(entry.timestamp);
  return `${action} • ${status} • ${when}`;
};

export const getCommandLogCardTitle = (item: CommandLogItem): string => {
  return getActionLabel(item);
};

export const getCommandLogCardSubtitle = (item: CommandLogItem): string => {
  const when = formatCommandLogDate(item.timestamp);
  const actor = normalizeActor(item.actor);
  const status = getStatusLabel(item.status);
  return `${when} • ${actor} • ${status}`;
};
