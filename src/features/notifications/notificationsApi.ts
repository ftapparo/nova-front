import { api } from "@/core/api/api";

// Envio de notificações pela equipe. Web Push vai para os navegadores do
// painel com alertas ativados (equipe); o aplicativo dos moradores recebe
// pelos Comunicados, não por aqui.

export interface StaffBroadcastResult {
  sentAt: number;
  dispatch: { totalSubscriptions: number; sent: number; failed: number; removedInvalid: number };
}

export const TITLE_MAX = 200;
export const BODY_MAX = 2000;

/** Aviso para todos os navegadores da equipe com alertas ativados. Só síndico/admin. */
export const sendStaffBroadcast = (title: string, body: string) =>
  api.post<StaffBroadcastResult>("/push/send", { title, body, tag: "aviso-equipe", data: { url: "/" } });

/** Teste nos aparelhos (aplicativo) da própria conta. 503 = envio desativado no servidor. */
export const sendAppTest = () => api.post<{ targets: number; sent: number; failed: number }>("/notifications/test");
