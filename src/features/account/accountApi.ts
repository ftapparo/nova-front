import { api } from "@/core/api/api";

// Preferências das notificações do aplicativo da própria conta. Valem para
// os aparelhos em que a pessoa usa o app; o alarme de incêndio ignora
// preferências (só o canal do celular controla).

export interface AppNotificationPreferences {
  exhaustExpiring: boolean;
  /** Fixo no servidor: quantos minutos antes do desligamento sai o aviso. */
  exhaustExpiringMinutes: number;
  exhaustOff: boolean;
  messages: boolean;
  cieStaffAlerts: boolean;
}

export type PreferenceKey = "exhaustExpiring" | "exhaustOff" | "messages" | "cieStaffAlerts";

export const PREFERENCES_KEY = ["notifications", "preferences"] as const;

export const fetchPreferences = (signal?: AbortSignal) =>
  api.get<AppNotificationPreferences>("/notifications/preferences", { signal });

export const updatePreference = (key: PreferenceKey, value: boolean) =>
  api.put<AppNotificationPreferences>("/notifications/preferences", { [key]: value });
