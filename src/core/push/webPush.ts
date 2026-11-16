import { api } from "@/core/api/api";

// Web Push deste navegador: é por aqui que a central de incêndio avisa os
// painéis da equipe (alarme, falha) e que síndico/admin mandam avisos.
// A inscrição é da conta logada: sai no logout e volta no login, como no
// painel anterior.

export type PushState = "unsupported" | "denied" | "off" | "on";

export const isPushSupported = (): boolean =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const urlBase64ToBytes = (base64: string): Uint8Array<ArrayBuffer> => {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
};

// O service worker é registrado pelo plugin no carregamento da página; aqui
// só se espera ele ficar pronto.
const registration = () => navigator.serviceWorker.ready;

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const subscription = await (await registration()).pushManager.getSubscription();
  return subscription ? "on" : "off";
}

/**
 * Pede a permissão (precisa vir de um clique) e inscreve o navegador na
 * conta logada. Devolve o estado final.
 */
export async function enablePush(): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";

  const reg = await registration();
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    const { publicKey } = await api.get<{ publicKey: string }>("/push/public-key");
    subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) });
  }
  await api.post("/push/subscriptions", {
    subscription: subscription.toJSON(),
    meta: { ua: navigator.userAgent.slice(0, 500), platform: "web" },
  });
  return "on";
}

/** Tira este navegador da conta logada. Usar antes do logout: precisa do token. */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const subscription = await (await registration()).pushManager.getSubscription();
  if (!subscription) return;
  try {
    await api.delete("/push/subscriptions", { endpoint: subscription.endpoint });
  } finally {
    // Mesmo se a API falhar, o navegador para de receber: no próximo login,
    // com a permissão já dada, ele se inscreve de novo na conta certa.
    await subscription.unsubscribe();
  }
}

/** No login: com a permissão já concedida, inscreve sem perguntar nada. */
export async function resumePush(): Promise<void> {
  if (isPushSupported() && Notification.permission === "granted") await enablePush();
}
