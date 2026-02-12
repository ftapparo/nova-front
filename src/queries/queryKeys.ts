export const queryKeys = {
  dashboard: {
    equipmentStatus: () => ["dashboard", "equipment-status"] as const,
  },
  exhaust: {
    processStatus: () => ["exhaust", "process-status"] as const,
  },
};
