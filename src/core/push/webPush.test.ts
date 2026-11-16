import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData } from "@/test/fakeApi";
import { disablePush, enablePush, getPushState, resumePush } from "./webPush";

// Navegador simulado: Notification, PushManager e service worker.
let permission: NotificationPermission = "default";
let subscription: { endpoint: string; toJSON: () => unknown; unsubscribe: ReturnType<typeof vi.fn> } | null = null;
const subscribe = vi.fn(async () => {
  subscription = {
    endpoint: "https://push.exemplo/abc",
    toJSON: () => ({ endpoint: "https://push.exemplo/abc", keys: { p256dh: "p", auth: "a" } }),
    unsubscribe: vi.fn(async () => {
      subscription = null;
      return true;
    }),
  };
  return subscription;
});
const requestPermission = vi.fn(async (): Promise<NotificationPermission> => {
  permission = "granted";
  return permission;
});

beforeEach(() => {
  permission = "default";
  subscription = null;
  subscribe.mockClear();
  requestPermission.mockClear();
  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal("Notification", {
    get permission() {
      return permission;
    },
    requestPermission,
  });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => subscription, subscribe } }) },
  });
  startSession(sessionData());
});

afterEach(() => {
  // @ts-expect-error -- remove o service worker simulado
  delete navigator.serviceWorker;
});

describe("webPush", () => {
  it("pede a permissão, inscreve com a chave da API e registra na conta", async () => {
    const requests = fakeApi({
      "GET /push/public-key": () => okResponse({ publicKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U" }),
      "POST /push/subscriptions": () => okResponse({ updatedAt: 1, totalSubscriptions: 1 }),
    });

    expect(await getPushState()).toBe("off");
    expect(await enablePush()).toBe("on");

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(requests.find((request) => request.method === "POST")?.body).toMatchObject({
      subscription: { endpoint: "https://push.exemplo/abc" },
      meta: { platform: "web" },
    });
    expect(await getPushState()).toBe("on");
  });

  it("respeita a permissão negada", async () => {
    requestPermission.mockImplementationOnce(async () => {
      permission = "denied";
      return permission;
    });
    const requests = fakeApi({});

    expect(await enablePush()).toBe("denied");
    expect(requests).toHaveLength(0);
  });

  it("no login só reinscreve se a permissão já foi dada, sem perguntar", async () => {
    const requests = fakeApi({});

    await resumePush();

    expect(requestPermission).not.toHaveBeenCalled();
    expect(requests).toHaveLength(0);
  });

  it("ao desativar, o navegador sai mesmo que a API falhe", async () => {
    permission = "granted";
    await subscribe();
    const requests = fakeApi({ "DELETE /push/subscriptions": () => errorResponse("internal-error", 500, null) });

    await expect(disablePush()).rejects.toBeTruthy();

    expect(requests.find((request) => request.method === "DELETE")?.body).toEqual({ endpoint: "https://push.exemplo/abc" });
    expect(subscription).toBeNull();
  });
});
