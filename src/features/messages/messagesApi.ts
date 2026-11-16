import { api } from "@/core/api/api";
import type { components } from "@/core/api/schema.gen";

// Comunicados do condomínio, os mesmos que o aplicativo mostra aos
// moradores. A lista traz só os visíveis agora: agendado aparece quando
// chegar a data; arquivado e vencido não aparecem.

export type CondoMessage = components["schemas"]["CondoMessage"];
export type MessageCategory = CondoMessage["category"];

export const MESSAGES_PAGE_SIZE = 20;
export const DEFAULT_CAROUSEL_TTL_HOURS = 24;
export const MAX_CAROUSEL_TTL_HOURS = 720;
export const TITLE_MAX = 120;
export const BODY_MAX = 5000;
export const LABEL_MAX = 40;

export const CATEGORY: Record<MessageCategory, { label: string; tone: "error" | "warning" | "info" | "neutral" }> = {
  urgente: { label: "Urgente", tone: "error" },
  aviso: { label: "Aviso", tone: "warning" },
  manutencao: { label: "Manutenção", tone: "info" },
  comunicado: { label: "Comunicado", tone: "neutral" },
};

export const fetchMessages = (offset: number, signal?: AbortSignal) =>
  api.get<{ items: CondoMessage[]; unreadCount: number }>("/messages", {
    query: { filter: "all", limit: MESSAGES_PAGE_SIZE, offset },
    signal,
  });

export interface NewMessage {
  category: MessageCategory;
  label?: string;
  title: string;
  body: string;
  /** ISO com fuso; omitido = publica agora. */
  publishedAt?: string;
  expiresAt?: string;
  carouselTtlHours: number;
  pinned: boolean;
  /** Push no aplicativo quando o comunicado ficar visível. */
  notify: boolean;
}

export const publishMessage = (input: NewMessage) => api.post<CondoMessage>("/messages", input);

/** Fixado fica no carrossel até desafixar e tem sempre tempo 0. */
export const setMessagePinned = (id: number, pinned: boolean) =>
  api.patch<CondoMessage>(`/messages/${id}`, pinned ? { pinned: true } : { pinned: false });

export const setMessageCarouselTtl = (id: number, carouselTtlHours: number) =>
  api.patch<CondoMessage>(`/messages/${id}`, { carouselTtlHours });

/** Arquiva: some da lista e do aplicativo; o registro fica guardado. */
export const archiveMessage = (id: number) => api.delete<null>(`/messages/${id}`);

/** Texto do tempo no carrossel para a tela. */
export function carouselLabel(message: Pick<CondoMessage, "pinned" | "carouselTtlHours">): string {
  if (message.pinned) return "Fixado no carrossel";
  if (message.carouselTtlHours === 0) return "No carrossel até cada morador ler";
  return `No carrossel por ${message.carouselTtlHours} h`;
}
