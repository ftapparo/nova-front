import { queryOptions } from "@tanstack/react-query";
import { api } from "@/core/api/api";
import type { components } from "@/core/api/schema.gen";

// Envio de notificações pela equipe. Web Push vai para os navegadores do
// painel com alertas ativados (equipe); o aplicativo dos moradores recebe
// pelos Comunicados, não por aqui.

export interface StaffBroadcastResult {
  sentAt: number;
  dispatch: { totalSubscriptions: number; sent: number; failed: number; removedInvalid: number };
}

export interface AppTestResult {
  targets: number;
  sent: number;
  failed: number;
}

export const TITLE_MAX = 200;
export const BODY_MAX = 2000;

/** Aviso para todos os navegadores da equipe com alertas ativados. Só síndico/admin. */
export const sendStaffBroadcast = (title: string, body: string) =>
  api.post<StaffBroadcastResult>("/push/send", { title, body, tag: "aviso-equipe", data: { url: "/" } });

/** Teste nos aparelhos (aplicativo) da própria conta. 503 = envio desativado no servidor. */
export const sendAppTest = () => api.post<AppTestResult>("/notifications/test");

export type AppDevice = components["schemas"]["NotificationDeviceSummary"];

/** Aparelhos do aplicativo de todas as contas. Só admin. */
export const appDevicesQuery = queryOptions({
  queryKey: ["notifications", "devices"],
  queryFn: ({ signal }) => api.get<AppDevice[]>("/notifications/devices", { signal }),
});

export type FireAlarmTestType = "alarm" | "resolved";

/**
 * Mesmo push do alarme real (ou do "central normalizada") para um único
 * aparelho, sem acionar a central. Só admin; 404 = aparelho sumiu ou desligou
 * as notificações; 3 testes a cada 10 minutos.
 */
export const sendFireAlarmTest = (installationId: string, type: FireAlarmTestType) =>
  api.post<AppTestResult>("/notifications/test/fire-alarm", { installationId, type });
