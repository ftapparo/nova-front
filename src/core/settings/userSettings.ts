import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/core/api/api";

// Preferências da conta (`/me/settings`), divididas com o aplicativo: até 50
// textos por chave. O PUT substitui o conjunto inteiro, então gravar uma
// chave sempre parte do conjunto atual do servidor — senão apagaria as
// preferências do aplicativo ou de outra aba.

export interface UserSettings {
  updatedAt: number;
  items: Record<string, string>;
  exists: boolean;
}

/** Prefixo das chaves deste painel, para não colidir com as do aplicativo. */
export const PANEL_SETTINGS_PREFIX = "painel.";

export const settingsQuery = queryOptions({
  queryKey: ["me", "settings"],
  queryFn: ({ signal }) => api.get<UserSettings>("/me/settings", { signal }),
});

const parseJson = <T>(raw: string | undefined, fallback: T): T => {
  if (raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Valor gravado por outra versão ou corrompido: vale o padrão.
    return fallback;
  }
};

/**
 * Lê e grava uma preferência em JSON. `fallback` vale enquanto carrega, sem
 * valor gravado ou com valor ilegível.
 */
export function useSetting<T>(key: string, fallback: T) {
  const queryClient = useQueryClient();
  const settings = useQuery(settingsQuery);
  const fullKey = `${PANEL_SETTINGS_PREFIX}${key}`;

  const save = useMutation({
    mutationFn: async (value: T) => {
      // Relê do servidor: o cache pode estar velho em relação ao aplicativo.
      const current = await queryClient.fetchQuery({ ...settingsQuery, staleTime: 0 });
      return api.put<UserSettings>("/me/settings", {
        items: { ...current.items, [fullKey]: JSON.stringify(value) },
        updatedAt: Date.now(),
      });
    },
    onSuccess: (saved) => queryClient.setQueryData(settingsQuery.queryKey, saved),
  });

  return {
    value: parseJson(settings.data?.items[fullKey], fallback),
    loading: settings.isPending,
    error: settings.error,
    save,
  };
}
