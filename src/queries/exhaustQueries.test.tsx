import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useExhaustProcessStatusQuery } from "@/queries/exhaustQueries";
import { api } from "@/services/api";

const createWrapper = (client: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe("useExhaustProcessStatusQuery", () => {
  it("configures polling and fetches once on mount", async () => {
    vi.spyOn(api, "exhaustProcessStatus").mockResolvedValue({ total: 0, memory: [], generatedAt: new Date().toISOString() });

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    renderHook(() => useExhaustProcessStatusQuery(), {
      wrapper: createWrapper(client),
    });

    await waitFor(() => {
      expect(api.exhaustProcessStatus).toHaveBeenCalledTimes(1);
    });

    const query = client.getQueryCache().find({ queryKey: ["exhaust", "process-status"] });
    expect(query?.options.refetchInterval).toBe(60_000);
    expect(query?.options.refetchIntervalInBackground).toBe(false);

    client.clear();
  });
});
