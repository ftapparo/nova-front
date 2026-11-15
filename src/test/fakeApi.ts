import { vi } from "vitest";
import type { SessionData, SessionUser } from "@/core/session/sessionStore";

// Respostas no formato do envelope da nova-api v3. Os testes nunca falam com
// a API real: comandos lá acionam equipamento físico.
const meta = { timestamp: "2026-11-13T00:00:00.000Z", requestId: "req-test", version: "v3" };

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

export const okResponse = (data: unknown, status = 200) => json({ success: true, data, meta }, status);

interface ErrorExtras {
  title?: string;
  validationErrors?: { path: string; message: string }[];
  retryAfter?: number;
}

export const errorResponse = (type: string, status: number, detail: string | null, extras: ErrorExtras = {}) =>
  json(
    {
      success: false,
      error: {
        type: `urn:nova-api:${type}`,
        title: extras.title ?? "Erro",
        status,
        detail,
        instance: "/v3/api/teste",
        validationErrors: extras.validationErrors,
      },
      meta,
    },
    status,
    extras.retryAfter ? { "Retry-After": String(extras.retryAfter) } : {},
  );

export interface FakeRequest {
  method: string;
  /** Caminho relativo a /v3/api, sem query string. */
  path: string;
  query: URLSearchParams;
  body: unknown;
  headers: Headers;
}

type FakeHandler = (request: FakeRequest) => Response | Promise<Response>;

/**
 * Substitui o fetch por rotas simuladas, com chave "MÉTODO /caminho".
 * Devolve a lista de requisições recebidas, na ordem.
 */
export function fakeApi(routes: Record<string, FakeHandler>): FakeRequest[] {
  const requests: FakeRequest[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const url = new URL(String(input), "http://localhost");
      const request: FakeRequest = {
        method: init.method ?? "GET",
        path: url.pathname.replace(/^\/v3\/api/, ""),
        query: url.searchParams,
        body: typeof init.body === "string" ? JSON.parse(init.body) : undefined,
        headers: new Headers(init.headers),
      };
      requests.push(request);

      const handler = routes[`${request.method} ${request.path}`];
      // Rota esquecida aparece na tela/asserção com nome, em vez de virar um erro genérico.
      if (!handler) return errorResponse("not-found", 404, `Rota não simulada no teste: ${request.method} ${request.path}`);
      return handler(request);
    }),
  );

  return requests;
}

export const sessionUser = (overrides: Partial<SessionUser> = {}): SessionUser => ({
  id: "9152eea2-c5e7-4fec-a296-85f20c68f51f",
  email: "portaria@novaresidence.com.br",
  role: "porteiro",
  mustChangePassword: false,
  mustAcceptTerms: false,
  ...overrides,
});

export const sessionData = (overrides: Partial<SessionData> = {}): SessionData => ({
  accessToken: "access-1",
  refreshToken: "refresh-1",
  tokenType: "bearer",
  expiresIn: 900,
  expiresAt: 1790636017,
  user: sessionUser(),
  ...overrides,
});
