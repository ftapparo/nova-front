import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/queries/queryKeys";

export const useExhaustProcessStatusQuery = () => {
  return useQuery({
    queryKey: queryKeys.exhaust.processStatus(),
    queryFn: api.exhaustProcessStatus,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
    gcTime: 300_000,
  });
};
