import { describe, expect, it, vi } from "vitest";
import { errorResponse, fakeApi, okResponse, sessionData } from "@/test/fakeApi";
import { ApiError } from "@/core/api/http";
import { endSession, getFreshAccessToken, getSession, refreshSession, startSession } from "./sessionStore";

const STORAGE_KEY = "nova-residence-v3-session";

const renewed = sessionData({ accessToken: "access-2", refreshToken: "refresh-2" });

describe("sessionStore", () => {
  it("guarda e encerra a sessão", () => {
    startSession(sessionData());

    expect(getSession()?.user.email).toBe("portaria@novaresidence.com.br");
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain("refresh-1");

    endSession();

    expect(getSession()).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("faz uma única renovação para chamadas simultâneas", async () => {
    const requests = fakeApi({ "POST /auth/refresh": () => okResponse(renewed) });
    startSession(sessionData());

    const [first, second] = await Promise.all([refreshSession(), refreshSession()]);

    expect(requests).toHaveLength(1);
    expect(requests[0]?.body).toEqual({ refreshToken: "refresh-1" });
    expect(first?.accessToken).toBe("access-2");
    expect(second?.accessToken).toBe("access-2");
    expect(getSession()?.refreshToken).toBe("refresh-2");
  });

  it("não gasta o refresh token se a sessão já foi renovada", async () => {
    const requests = fakeApi({ "POST /auth/refresh": () => okResponse(renewed) });
    startSession(sessionData());
    await refreshSession("access-1");

    // Outra requisição que também recebeu 401 com o token antigo.
    const session = await refreshSession("access-1");

    expect(requests).toHaveLength(1);
    expect(session?.accessToken).toBe("access-2");
  });

  it("adota a sessão renovada por outra aba em vez de renovar de novo", async () => {
    const requests = fakeApi({ "POST /auth/refresh": () => okResponse(renewed) });
    const mine = startSession(sessionData());
    // Outra aba renovou e gravou; o evento de storage ainda não chegou aqui.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...mine, accessToken: "access-outra-aba", refreshToken: "refresh-outra-aba" }),
    );

    const session = await refreshSession();

    expect(requests).toHaveLength(0);
    expect(session?.accessToken).toBe("access-outra-aba");
    expect(getSession()?.refreshToken).toBe("refresh-outra-aba");
  });

  it("renova dentro do Web Lock quando o navegador oferece", async () => {
    fakeApi({ "POST /auth/refresh": () => okResponse(renewed) });
    const request = vi.fn((_name: string, task: () => Promise<unknown>) => task());
    vi.stubGlobal("navigator", { locks: { request } });
    startSession(sessionData());

    const session = await refreshSession();

    expect(request).toHaveBeenCalledWith("nova-residence-v3-session-refresh", expect.any(Function));
    expect(session?.accessToken).toBe("access-2");
  });

  it("encerra a sessão quando o servidor recusa o refresh token", async () => {
    fakeApi({ "POST /auth/refresh": () => errorResponse("unauthorized", 401, "Credenciais inválidas.") });
    startSession(sessionData());

    expect(await refreshSession()).toBeNull();
    expect(getSession()).toBeNull();
  });

  it("mantém a sessão quando a renovação falha por indisponibilidade", async () => {
    fakeApi({
      "POST /auth/refresh": () => errorResponse("upstream-error", 503, "Serviço de autenticação indisponível."),
    });
    startSession(sessionData());

    await expect(refreshSession()).rejects.toBeInstanceOf(ApiError);
    expect(getSession()?.refreshToken).toBe("refresh-1");
  });

  it("acompanha o logout feito em outra aba", () => {
    startSession(sessionData());

    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));

    expect(getSession()).toBeNull();
  });

  it("ignora conteúdo inválido gravado no navegador", () => {
    startSession(sessionData());

    window.localStorage.setItem(STORAGE_KEY, "{ isto não é json");
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));

    expect(getSession()).toBeNull();
  });

  describe("getFreshAccessToken", () => {
    it("devolve o token atual enquanto ele está longe de expirar", async () => {
      const requests = fakeApi({});
      startSession(sessionData());

      expect(await getFreshAccessToken()).toBe("access-1");
      expect(requests).toHaveLength(0);
    });

    it("renova antes quando o token está no fim", async () => {
      fakeApi({ "POST /auth/refresh": () => okResponse(renewed) });
      startSession(sessionData({ expiresIn: 30 }));

      expect(await getFreshAccessToken()).toBe("access-2");
    });

    it("devolve null sem sessão", async () => {
      expect(await getFreshAccessToken()).toBeNull();
    });
  });
});
