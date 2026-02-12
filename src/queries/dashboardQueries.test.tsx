import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEquipmentStatusQuery } from "@/queries/dashboardQueries";
import { api } from "@/services/api";

const createWrapper = (client: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe("useEquipmentStatusQuery", () => {
  it("configures polling and fetches once on mount", async () => {
    vi.spyOn(api, "controlStatus").mockResolvedValue({ updatedAt: null, gates: [], doors: [], error: null });
    vi.spyOn(api, "exhaustStatusAll").mockResolvedValue({ modules: {}, memory: [] });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderHook(() => useEquipmentStatusQuery(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(api.controlStatus).toHaveBeenCalledTimes(1);
      expect(api.exhaustStatusAll).toHaveBeenCalledTimes(1);
    });

    const query = client.getQueryCache().find({ queryKey: ["dashboard", "equipment-status"] });
    expect(query?.options.refetchInterval).toBe(15_000);
    expect(query?.options.refetchIntervalInBackground).toBe(false);

    client.clear();
  });
});
