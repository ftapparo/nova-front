import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/queries/queryKeys";

const shouldLogQuery = import.meta.env.MODE !== "production";

export const useExhaustProcessStatusQuery = () => {
  return useQuery({
    queryKey: queryKeys.exhaust.processStatus(),
    queryFn: async () => {
      if (shouldLogQuery) {
        console.log("[tanstack-query] exhaustProcessStatus", { queryKey: queryKeys.exhaust.processStatus() });
      }
      return api.exhaustProcessStatus();
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
    gcTime: 300_000,
  });
};
