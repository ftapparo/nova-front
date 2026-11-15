import { describe, expect, it, vi } from "vitest";
import { errorResponse, fakeApi, okResponse } from "@/test/fakeApi";
import { ApiError, errorMessage, sendRequest } from "./http";

const failure = async (promise: Promise<unknown>): Promise<ApiError> => {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  if (!(error instanceof ApiError)) throw new Error("esperava um ApiError");
  return error;
};

describe("sendRequest", () => {
  it("devolve o data do envelope e monta a requisição", async () => {
    const requests = fakeApi({ "POST /exhausts/A4/on": () => okResponse({ id: "A4", on: true }) });

    const data = await sendRequest("POST", "/exhausts/A4/on", {
      body: { minutes: 30 },
      query: { limit: 10, vazio: undefined },
      token: "abc",
    });

    expect(data).toEqual({ id: "A4", on: true });
    expect(requests[0]?.body).toEqual({ minutes: 30 });
    expect(requests[0]?.query.toString()).toBe("limit=10");
    expect(requests[0]?.headers.get("Authorization")).toBe("Bearer abc");
    expect(requests[0]?.headers.get("Accept-Language")).toBe("pt-BR");
  });

  it("transforma o envelope de erro em ApiError", async () => {
    fakeApi({
      "POST /auth/login": () =>
        errorResponse("rate-limited", 429, "Muitas tentativas. Tente novamente mais tarde.", {
          title: "Limite excedido",
          retryAfter: 42,
        }),
    });

    const error = await failure(sendRequest("POST", "/auth/login", { body: {} }));

    expect(error.type).toBe("rate-limited");
    expect(error.status).toBe(429);
    expect(error.title).toBe("Limite excedido");
    expect(error.message).toBe("Muitas tentativas. Tente novamente mais tarde.");
    expect(error.retryAfterSeconds).toBe(42);
    expect(error.requestId).toBe("req-test");
  });

  it("entrega os erros de campo", async () => {
    fakeApi({
      "POST /auth/login": () =>
        errorResponse("validation-error", 400, "Um ou mais campos da requisição são inválidos.", {
          validationErrors: [{ path: "/email", message: "E-mail inválido" }],
        }),
    });

    const error = await failure(sendRequest("POST", "/auth/login", { body: {} }));

    expect(error.type).toBe("validation-error");
    expect(error.validationErrors).toEqual([{ path: "/email", message: "E-mail inválido" }]);
  });

  it("usa um texto padrão quando o servidor não manda detail", async () => {
    fakeApi({ "GET /doors": () => errorResponse("forbidden", 403, null) });

    const error = await failure(sendRequest("GET", "/doors"));

    expect(errorMessage(error)).toBe("Acesso negado.");
  });

  it("classifica pelo status um type desconhecido", async () => {
    fakeApi({ "GET /doors": () => errorResponse("tipo-novo", 409, "Recusado.") });

    expect((await failure(sendRequest("GET", "/doors"))).type).toBe("conflict");
  });

  it("trata falha de rede como network-error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const error = await failure(sendRequest("GET", "/health"));

    expect(error.type).toBe("network-error");
    expect(error.status).toBe(0);
    expect(error.message).toBe("Sem conexão com o servidor.");
  });

  it("trata resposta sem envelope pelo status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>Bad Gateway</html>", { status: 502 })));

    expect((await failure(sendRequest("GET", "/health"))).type).toBe("upstream-error");
  });

  it("não aceita 200 que não seja o envelope da API", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!doctype html>", { status: 200 })));

    const error = await failure(sendRequest("GET", "/health"));

    expect(error.type).toBe("internal-error");
    expect(error.message).toBe("Resposta inesperada do servidor.");
  });

  it("não quebra com corpo de erro malformado", async () => {
    const body = { success: false, error: { type: 123, validationErrors: "x" }, meta: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 500 })));

    const error = await failure(sendRequest("GET", "/health"));

    expect(error.type).toBe("internal-error");
    expect(error.validationErrors).toEqual([]);
  });

  it("repassa o cancelamento sem transformar em erro de rede", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("cancelado", "AbortError")));

    await expect(sendRequest("GET", "/health")).rejects.toMatchObject({ name: "AbortError" });
  });
});
