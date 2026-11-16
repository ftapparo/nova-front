import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/core/session/useSession";
import { disablePush, enablePush, getPushState, resumePush } from "./webPush";

const PUSH_STATE_KEY = ["push", "state"] as const;

/** Situação do Web Push neste navegador e as ações de ligar e desligar. */
export function usePushState() {
  const queryClient = useQueryClient();
  const state = useQuery({ queryKey: PUSH_STATE_KEY, queryFn: getPushState, staleTime: Infinity });
  const update = () => void queryClient.invalidateQueries({ queryKey: PUSH_STATE_KEY });

  const enable = useMutation({ mutationFn: enablePush, onSettled: update });
  const disable = useMutation({ mutationFn: disablePush, onSettled: update });

  return { state: state.data, loading: state.isPending, enable, disable };
}

/** No login: se este navegador já tinha permissão, volta a receber os alertas. */
export function useResumePush() {
  const queryClient = useQueryClient();
  const userId = useSession()?.user.id;

  useEffect(() => {
    if (!userId) return;
    resumePush()
      .catch((error: unknown) => console.error("[push] Falha ao reinscrever o navegador:", error))
      .finally(() => void queryClient.invalidateQueries({ queryKey: PUSH_STATE_KEY }));
  }, [userId, queryClient]);
}
