import { getFreshAccessToken, refreshSession, updateSessionUser } from "@/core/session/sessionStore";
import { ApiError, sendRequest, type HttpMethod, type RequestOptions } from "./http";

// Título estável documentado no contrato: com senha provisória, toda rota
// fora de /auth responde 403 com ele.
const PASSWORD_CHANGE_REQUIRED_TITLE = "Troca de senha obrigatória";

export interface AuthorizedOptions extends RequestOptions {
  /**
   * Para rotas em que 401 é a resposta de negócio e não sessão vencida
   * (ex.: "Senha atual incorreta" na troca de senha). Sem isto, o 401
   * dispararia renovação da sessão e o reenvio da mesma senha errada.
   */
  noRefreshOn401?: boolean;
}

async function authorizedRequest<T>(
  method: HttpMethod,
  path: string,
  { noRefreshOn401 = false, ...options }: AuthorizedOptions = {},
): Promise<T> {
  const token = await getFreshAccessToken();
  if (!token) throw new ApiError({ type: "unauthorized", status: 401 });

  try {
    return await sendRequest<T>(method, path, { ...options, token });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    if (error.type === "forbidden" && error.title === PASSWORD_CHANGE_REQUIRED_TITLE) {
      // A senha foi resetada pela equipe com esta sessão aberta: marcar aqui
      // faz a guarda de rotas levar direto para a troca de senha.
      updateSessionUser({ mustChangePassword: true });
    }
    if (error.type !== "unauthorized" || noRefreshOn401) throw error;

    // 401 = recusado na autenticação, antes de qualquer efeito. Por isso
    // repetir uma vez é seguro até para comando de equipamento físico.
    const session = await refreshSession(token);
    if (!session) throw error;
    return sendRequest<T>(method, path, { ...options, token: session.accessToken });
  }
}

type BodylessOptions = Omit<AuthorizedOptions, "body">;

/** Chamadas autenticadas à v3. Caminhos relativos a /v3/api. */
export const api = {
  get: <T>(path: string, options?: BodylessOptions) => authorizedRequest<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: BodylessOptions) =>
    authorizedRequest<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: BodylessOptions) =>
    authorizedRequest<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: BodylessOptions) =>
    authorizedRequest<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, body?: unknown, options?: BodylessOptions) =>
    authorizedRequest<T>("DELETE", path, { ...options, body }),
};
