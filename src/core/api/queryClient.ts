import { QueryClient } from "@tanstack/react-query";
import { getSession, subscribeSession } from "@/core/session/sessionStore";
import { ApiError } from "./http";

// Só vale repetir sozinho o que pode ter sido passageiro. 4xx é resposta
// definitiva do servidor: repetir não muda o resultado.
const isTransient = (error: unknown): boolean =>
  error instanceof ApiError &&
  (error.type === "network-error" || error.type === "upstream-error" || error.type === "internal-error");

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => failureCount < 1 && isTransient(error),
    },
    mutations: {
      // Mutations incluem comandos em equipamento físico (portão, exaustor,
      // central de incêndio): nunca repetir automaticamente.
      retry: false,
    },
  },
});

// Dados em cache pertencem a quem estava logado: saem quando a conta muda
// (logout, ou outro login feito em outra aba).
let cachedUserId = getSession()?.user.id ?? null;
subscribeSession(() => {
  const userId = getSession()?.user.id ?? null;
  if (userId === cachedUserId) return;
  cachedUserId = userId;
  queryClient.clear();
});
