import { useQuery } from "@tanstack/react-query";
import { api, type ControlStatusResponse, type ExhaustStatusResponse } from "@/services/api";
import { queryKeys } from "@/queries/queryKeys";

const shouldLogQuery = import.meta.env.MODE !== "production";

export interface EquipmentStatusResult {
  controlStatus: ControlStatusResponse;
  exhaustStatus: ExhaustStatusResponse;
}

export const fetchEquipmentStatus = async (): Promise<EquipmentStatusResult> => {
  if (shouldLogQuery) {
    console.log("[tanstack-query] fetchEquipmentStatus", { queryKey: queryKeys.dashboard.equipmentStatus() });
  }

  const [controlStatus, exhaustStatus] = await Promise.all([
    api.controlStatus(),
    api.exhaustStatusAll(),
  ]);

  return { controlStatus, exhaustStatus };
};

export const useEquipmentStatusQuery = () => {
  return useQuery({
    queryKey: queryKeys.dashboard.equipmentStatus(),
    queryFn: fetchEquipmentStatus,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
    staleTime: 10_000,
    gcTime: 300_000,
  });
};
