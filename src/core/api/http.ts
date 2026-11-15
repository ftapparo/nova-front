// Sempre a própria origem: a v3 não tem CORS. Quem repassa /v3 para a
// nova-api é o Vite (desenvolvimento) ou o nginx do container (produção).
const API_BASE = "/v3/api";
const ERROR_TYPE_PREFIX = "urn:nova-api:";

const SERVER_ERROR_TYPES = [
  "validation-error",
  "unauthorized",
  "forbidden",
  "not-found",
  "conflict",
  "rate-limited",
  "upstream-error",
  "internal-error",
] as const;

/**
 * Conjunto fechado de `error.type` da v3, sem o prefixo `urn:nova-api:`.
 * `network-error` não vem do servidor: a requisição nem chegou até ele.
 */
export type ApiErrorType = (typeof SERVER_ERROR_TYPES)[number] | "network-error";

export interface ValidationError {
  path: string;
  message: string;
}

const FALLBACK_DETAIL: Record<ApiErrorType, string> = {
  "validation-error": "Um ou mais campos são inválidos.",
  unauthorized: "Sessão expirada. Entre novamente.",
  forbidden: "Acesso negado.",
  "not-found": "Não encontrado.",
  conflict: "A operação não pôde ser concluída.",
  "rate-limited": "Muitas tentativas. Aguarde um momento e tente de novo.",
  "upstream-error": "Serviço ou equipamento indisponível. Tente novamente.",
  "internal-error": "Erro interno. Tente novamente.",
  "network-error": "Sem conexão com o servidor.",
};

interface ApiErrorInit {
  type: ApiErrorType;
  status: number;
  title?: string;
  detail?: string | null;
  validationErrors?: ValidationError[];
  retryAfterSeconds?: number | null;
  requestId?: string | null;
}

/**
 * Erro de uma chamada à API. `message` é o `detail` do servidor (seguro para
 * exibir) ou um texto padrão do tipo. Decisões de tela usam `type` — nunca o
 * texto de `detail`, que não é estável.
 */
export class ApiError extends Error {
  readonly type: ApiErrorType;
  /** Status HTTP; 0 quando não houve resposta. */
  readonly status: number;
  readonly title: string;
  readonly validationErrors: ValidationError[];
  /** Segundos do cabeçalho Retry-After (429), quando informado. */
  readonly retryAfterSeconds: number | null;
  /** Para colar em relatos de erro. */
  readonly requestId: string | null;

  constructor(init: ApiErrorInit) {
    super(init.detail?.trim() || FALLBACK_DETAIL[init.type]);
    this.name = "ApiError";
    this.type = init.type;
    this.status = init.status;
    this.title = init.title ?? "";
    this.validationErrors = init.validationErrors ?? [];
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
    this.requestId = init.requestId ?? null;
  }
}

/** Texto para mostrar ao usuário a partir de qualquer erro capturado. */
export const errorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : "Ocorreu um erro inesperado.";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  signal?: AbortSignal;
}

const isServerErrorType = (value: string): value is (typeof SERVER_ERROR_TYPES)[number] =>
  (SERVER_ERROR_TYPES as readonly string[]).includes(value);

// Resposta sem envelope (HTML de um proxy, gateway fora do ar) ou com um
// `type` que este painel ainda não conhece: classifica pelo status.
const typeFromStatus = (status: number): ApiErrorType => {
  if (status === 400) return "validation-error";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate-limited";
  if (status === 502 || status === 503 || status === 504) return "upstream-error";
  return "internal-error";
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const textOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);

// O corpo do erro é lido campo a campo, sem confiar no formato: uma resposta
// malformada não pode virar exceção de tipo no meio do tratamento de erro.
const errorFromProblem = (problem: Record<string, unknown>, response: Response, requestId: string | null): ApiError => {
  const urn = textOrNull(problem.type) ?? "";
  const name = urn.startsWith(ERROR_TYPE_PREFIX) ? urn.slice(ERROR_TYPE_PREFIX.length) : "";
  const validationErrors = (Array.isArray(problem.validationErrors) ? problem.validationErrors : []).flatMap(
    (item: unknown): ValidationError[] => {
      if (!isRecord(item)) return [];
      const path = textOrNull(item.path);
      const message = textOrNull(item.message);
      return path !== null && message !== null ? [{ path, message }] : [];
    },
  );

  return new ApiError({
    type: isServerErrorType(name) ? name : typeFromStatus(response.status),
    status: response.status,
    title: textOrNull(problem.title) ?? "",
    detail: textOrNull(problem.detail),
    validationErrors,
    retryAfterSeconds: retryAfterFrom(response),
    requestId,
  });
};

const retryAfterFrom = (response: Response): number | null => {
  const seconds = Number(response.headers.get("Retry-After"));
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : null;
};

const buildUrl = (path: string, query: RequestOptions["query"]): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return `${API_BASE}${path}${search ? `?${search}` : ""}`;
};

/**
 * Faz uma chamada à v3 e devolve o `data` do envelope. Não conhece sessão:
 * quem precisa de token usa `api` (core/api/api.ts).
 */
export async function sendRequest<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions & { token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", "Accept-Language": "pt-BR" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    // Cancelamento não é falha de rede: quem cancelou trata.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError({ type: "network-error", status: 0 });
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    // Corpo não-JSON: tratado logo abaixo como resposta fora do contrato.
  }

  if (isRecord(payload) && payload.success === true && response.ok) {
    return payload.data as T;
  }

  const requestId = isRecord(payload) && isRecord(payload.meta) ? textOrNull(payload.meta.requestId) : null;

  if (isRecord(payload) && payload.success === false && isRecord(payload.error)) {
    throw errorFromProblem(payload.error, response, requestId);
  }

  throw new ApiError({
    // 2xx sem envelope = algo no caminho respondeu no lugar da API.
    type: response.ok ? "internal-error" : typeFromStatus(response.status),
    status: response.status,
    detail: response.ok ? "Resposta inesperada do servidor." : null,
    retryAfterSeconds: retryAfterFrom(response),
    requestId,
  });
}
