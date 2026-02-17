import { api, type PushSubscribePayload } from '@/services/api';

const PUSH_PLATFORM = 'web';

const hasPushSupport = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
};

const urlBase64ToArrayBuffer = (base64String: string): ArrayBuffer => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const bytes = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    bytes[i] = rawData.charCodeAt(i);
  }

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

const getServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!hasPushSupport()) return null;

  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) {
    return existing;
  }

  if (navigator.serviceWorker.controller) {
    return navigator.serviceWorker.ready;
  }

  return null;
};

const toPayload = (user: string, subscription: PushSubscription): PushSubscribePayload => ({
  user,
  subscription: subscription.toJSON() as PushSubscribePayload['subscription'],
  meta: {
    ua: typeof navigator.userAgent === 'string' ? navigator.userAgent : null,
    platform: PUSH_PLATFORM,
  },
});

export const ensurePushSubscription = async (user: string): Promise<void> => {
  const normalizedUser = String(user || '').trim().toUpperCase();
  if (!normalizedUser || !hasPushSupport()) return;

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;

  if (permission !== 'granted') {
    return;
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    console.warn('[WebPush] Service Worker nao encontrado para registrar subscription.');
    return;
  }

  const { publicKey } = await api.pushPublicKey();
  const applicationServerKey = urlBase64ToArrayBuffer(publicKey);

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  await api.pushSubscribe(toPayload(normalizedUser, subscription));
};

export const removePushSubscription = async (user: string): Promise<void> => {
  const normalizedUser = String(user || '').trim().toUpperCase();
  if (!normalizedUser || !hasPushSupport()) return;

  const registration = await getServiceWorkerRegistration();
  if (!registration) return;

  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;

  try {
    await subscription.unsubscribe();
  } catch {
    // segue para limpar no backend mesmo se unsubscribe local falhar
  }

  try {
    await api.pushUnsubscribe({
      user: normalizedUser,
      endpoint,
    });
  } catch (error) {
    console.error('[WebPush] Falha ao remover subscription no backend:', error);
  }
};
