/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<unknown>;
};

clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('push', (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() as Record<string, unknown> : {};
    } catch {
      return {};
    }
  })();

  const title = typeof payload.title === 'string' && payload.title.trim()
    ? payload.title.trim()
    : 'Alerta';
  const body = typeof payload.body === 'string' && payload.body.trim()
    ? payload.body.trim()
    : 'Nova notificacao recebida.';
  const tag = typeof payload.tag === 'string' && payload.tag.trim()
    ? payload.tag.trim()
    : 'general';

  const data = (typeof payload.data === 'object' && payload.data !== null)
    ? payload.data
    : { url: '/dashboard/incendio' };

  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    requireInteraction: Boolean(payload.requireInteraction),
    icon: typeof payload.icon === 'string' ? payload.icon : '/icons/icon-192.png',
    badge: typeof payload.badge === 'string' ? payload.badge : '/icons/icon-192.png',
    data,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const payloadData = event.notification.data as { url?: string } | undefined;
  const targetPath = payloadData?.url && typeof payloadData.url === 'string'
    ? payloadData.url
    : '/dashboard/incendio';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) {
          await client.navigate(targetPath);
        }
        return;
      }
    }

    await self.clients.openWindow(targetPath);
  })());
});

export {};
