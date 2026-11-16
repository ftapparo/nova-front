/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

// Service worker do painel: guarda os arquivos do build para abrir rápido e
// recebe o Web Push da API (alarme e falha da central de incêndio, avisos à
// equipe). Mesmo comportamento do painel anterior.

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<unknown> };

const DEFAULT_TARGET = "/incendio";

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute((self.__WB_MANIFEST ?? []) as Parameters<typeof precacheAndRoute>[0]);

const text = (value: unknown, fallback: string) => (typeof value === "string" && value.trim() ? value.trim() : fallback);

// A central ainda manda os endereços do painel anterior (/dashboard/incendio);
// no painel novo as telas ficam na raiz.
const toPanelPath = (url: unknown) => {
  const path = typeof url === "string" && url.startsWith("/") ? url : DEFAULT_TARGET;
  return path.replace(/^\/dashboard(?=\/|$)/, "") || "/";
};

self.addEventListener("push", (event) => {
  let payload: Record<string, unknown> = {};
  try {
    payload = (event.data?.json() as Record<string, unknown>) ?? {};
  } catch {
    // Push sem JSON: mostra o aviso genérico.
  }
  const data = typeof payload.data === "object" && payload.data !== null ? (payload.data as Record<string, unknown>) : {};

  event.waitUntil(
    self.registration.showNotification(text(payload.title, "Nova Residence"), {
      body: text(payload.body, "Nova notificação."),
      tag: text(payload.tag, "general"),
      requireInteraction: Boolean(payload.requireInteraction),
      icon: text(payload.icon, "/icons/icon-192.png"),
      badge: text(payload.badge, "/icons/icon-192.png"),
      data: { url: toPanelPath(data.url) },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = toPanelPath((event.notification.data as { url?: unknown } | undefined)?.url);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const panel = windows[0];
      if (panel) {
        await panel.focus();
        await panel.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
