// Atalhos do Painel Operacional, por conta (preferência "painel.atalhos").

export type ShortcutKind = "door" | "gate";

export interface Shortcut {
  id: string;
  kind: ShortcutKind;
  /** id da porta ou numeroDispositivo do portão. */
  target: number;
  /** Nome escolhido pela pessoa; vazio usa o nome do equipamento. */
  label: string;
}

export const SHORTCUTS_SETTING = "atalhos";
export const MAX_SHORTCUTS = 8;

/** Lê o valor gravado descartando o que não tiver o formato esperado. */
export function sanitizeShortcuts(value: unknown): Shortcut[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is Shortcut =>
        typeof item === "object" &&
        item !== null &&
        typeof item.id === "string" &&
        (item.kind === "door" || item.kind === "gate") &&
        Number.isInteger(item.target) &&
        typeof item.label === "string",
    )
    .slice(0, MAX_SHORTCUTS);
}

export const newShortcutId = () =>
  typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
