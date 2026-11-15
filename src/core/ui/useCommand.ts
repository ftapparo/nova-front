import { useMutation } from "@tanstack/react-query";
import { ApiError, errorMessage } from "@/core/api/http";
import { useNotify } from "./components/useNotify";
import { useCooldown } from "./useCooldown";

interface CommandOptions<TVariables, TData> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Aviso de sucesso; sem ele, a tela mostra o resultado de outro jeito. */
  successMessage?: (data: TData, variables: TVariables) => string;
  onSuccess?: (data: TData, variables: TVariables) => void;
}

export interface Command<TVariables> {
  run: (variables: TVariables) => void;
  pending: boolean;
  /** Segundos de espera pedidos pelo servidor (429); 0 = liberado. */
  cooldownSeconds: number;
  /** Botão deve ficar travado: comando em andamento ou espera do 429. */
  busy: boolean;
}

/**
 * Comando em equipamento físico (portão, porta, exaustor, central de
 * incêndio). Nunca repete sozinho — vários comandos alternam estado, e uma
 * repetição desfaria o primeiro. Erro vira aviso com o `detail` do servidor:
 * 409 (equipamento recusou) não se resolve tentando de novo, e 502/503 o
 * operador repete à mão, se quiser.
 */
export function useCommand<TVariables = void, TData = unknown>({
  mutationFn,
  successMessage,
  onSuccess,
}: CommandOptions<TVariables, TData>): Command<TVariables> {
  const notify = useNotify();
  const cooldown = useCooldown();

  const mutation = useMutation({
    mutationFn,
    retry: false,
    onSuccess: (data, variables) => {
      if (successMessage) notify.success(successMessage(data, variables));
      onSuccess?.(data, variables);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.type === "rate-limited" && error.retryAfterSeconds) {
        cooldown.start(error.retryAfterSeconds);
      }
      notify.error(errorMessage(error));
    },
  });

  return {
    run: (variables) => mutation.mutate(variables),
    pending: mutation.isPending,
    cooldownSeconds: cooldown.remainingSeconds,
    busy: mutation.isPending || cooldown.remainingSeconds > 0,
  };
}
