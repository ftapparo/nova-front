import { api } from "@/core/api/api";
import type { components } from "@/core/api/schema.gen";

// Central de incêndio (CIE2500), pela nova-api. O backend já interpreta cada
// evento: o painel nunca lê `eventType` nem desmonta `deviceName` — usa
// `event` (rótulo, natureza, gravidade) e `display` (cada dado no seu campo).

export type Panel = components["schemas"]["PanelData"];
export type Situation = components["schemas"]["CiePanelSituation"];
export type Severity = components["schemas"]["CieSeverity"];
export type CieLog = components["schemas"]["NormalizedCieLog"];
export type CiePlace = components["schemas"]["CiePlace"];
export type ActiveEvents = components["schemas"]["CieActiveEventsData"];
export type LogsPage = components["schemas"]["LogsListData"];
export type Installation = components["schemas"]["CieInstallation"];
export type BlockCounters = components["schemas"]["BlockCounters"];

export type LogType = "operacao" | "alarme" | "falha" | "supervisao" | "bloqueio";
export type ActiveType = "alarme" | "falha" | "supervisao";

export const LOGS_PAGE_SIZE = 30;

export const fetchPanel = (signal?: AbortSignal) => api.get<Panel>("/cie/panel", { signal });
export const fetchActiveEvents = (signal?: AbortSignal) => api.get<ActiveEvents>("/cie/events/active", { signal });
export const fetchInstallation = (signal?: AbortSignal) => api.get<Installation>("/cie/installation", { signal });
export const fetchBlockCounters = (signal?: AbortSignal) => api.get<BlockCounters>("/cie/counters/blocks", { signal });

/** Histórico paginado por cursor: o próximo cursor vem dentro de `data`. */
export const fetchLogs = (
  input: { type: LogType; onlyOccurrences: boolean; cursor: string | null },
  signal?: AbortSignal,
) =>
  api.get<LogsPage>("/cie/logs", {
    query: {
      type: input.type,
      kind: input.onlyOccurrences ? "ativacao" : undefined,
      limit: LOGS_PAGE_SIZE,
      cursor: input.cursor ?? undefined,
    },
    signal,
  });

/**
 * Botões da central usados pelo painel (os mesmos do painel anterior).
 * `alarm-general` e `restart` exigem `confirm: true`: a tela confirma antes.
 */
export type ButtonAction = "silence-bip" | "silence-siren" | "release-siren" | "alarm-general" | "restart";

const NEEDS_CONFIRM: ReadonlySet<ButtonAction> = new Set(["alarm-general", "restart"]);

export const sendButtonCommand = (action: ButtonAction) =>
  api.post<{ action: string; snapshot: unknown }>(
    `/cie/commands/${action}`,
    NEEDS_CONFIRM.has(action) ? { confirm: true } : {},
  );

/** "Torre B · 16º andar · Posição B", ou a área ("Garagem · 2 C"). Só junta os rótulos prontos. */
export function placeLabel(place: CiePlace | null | undefined): string | null {
  if (!place) return null;
  const parts = place.area
    ? [place.towerLabel, place.area, place.areaDetail]
    : [place.towerLabel, place.floorLabel, place.positionLabel];
  const label = parts.filter(Boolean).join(" · ");
  return label || null;
}

export const SEVERITY_TONE: Record<Severity, "error" | "warning" | "info" | "success"> = {
  critical: "error",
  warning: "warning",
  info: "info",
  ok: "success",
};
