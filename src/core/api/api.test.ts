import { describe, expect, it } from "vitest";
import { getSession, startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData } from "@/test/fakeApi";
import { api } from "./api";

const renewed = sessionData({ accessToken: "access-2", refreshToken: "refresh-2" });
const expired = () => errorResponse("unauthorized", 401, "Token inválido ou expirado.");

describe("api", () => {
  it("envia o access token da sessão", async () => {
    const requests = fakeApi({ "GET /doors": () => okResponse([]) });
    startSession(sessionData());

    await api.get("/doors");

    expect(requests[0]?.headers.get("Authorization")).toBe("Bearer access-1");
  });

  it("não chama a API sem sessão", async () => {
    const requests = fakeApi({});

    await expect(api.get("/doors")).rejects.toMatchObject({ type: "unauthorized" });
    expect(requests).toHaveLength(0);
  });

  it("no 401 renova a sessão uma vez e repete a chamada uma vez", async () => {
    const requests = fakeApi({
      "POST /doors/1/open": ({ headers }) =>
        headers.get("Authorization") === "Bearer access-2" ? okResponse({ id: 1 }) : expired(),
      "POST /auth/refresh": () => okResponse(renewed),
    });
    startSession(sessionData());

    expect(await api.post("/doors/1/open")).toEqual({ id: 1 });
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      "POST /doors/1/open",
      "POST /auth/refresh",
      "POST /doors/1/open",
    ]);
  });

  it("não insiste se a chamada repetida também volta 401", async () => {
    const requests = fakeApi({ "GET /doors": expired, "POST /auth/refresh": () => okResponse(renewed) });
    startSession(sessionData());

    await expect(api.get("/doors")).rejects.toMatchObject({ type: "unauthorized" });
    expect(requests).toHaveLength(3);
  });

  it("encerra a sessão quando a renovação é recusada", async () => {
    const requests = fakeApi({ "GET /doors": expired, "POST /auth/refresh": expired });
    startSession(sessionData());

    await expect(api.get("/doors")).rejects.toMatchObject({ type: "unauthorized" });
    expect(getSession()).toBeNull();
    expect(requests).toHaveLength(2);
  });

  it("não renova quando o 401 é a resposta da rota", async () => {
    const requests = fakeApi({
      "POST /auth/password/change": () => errorResponse("unauthorized", 401, "Senha atual incorreta."),
    });
    startSession(sessionData());

    await expect(api.post("/auth/password/change", {}, { noRefreshOn401: true })).rejects.toMatchObject({
      message: "Senha atual incorreta.",
    });
    expect(requests).toHaveLength(1);
    expect(getSession()?.refreshToken).toBe("refresh-1");
  });

  it("marca a troca de senha obrigatória quando a API passa a exigir", async () => {
    fakeApi({
      "GET /doors": () =>
        errorResponse("forbidden", 403, "Troque a senha para continuar.", { title: "Troca de senha obrigatória" }),
    });
    startSession(sessionData());

    await expect(api.get("/doors")).rejects.toMatchObject({ type: "forbidden" });
    expect(getSession()?.user.mustChangePassword).toBe(true);
  });
});
