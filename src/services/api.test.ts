import { beforeEach, describe, expect, it, vi } from "vitest";
import * as axiosModule from "axios";
import { api } from "@/services/api";

vi.mock("axios", () => {
  const request = vi.fn();

  return {
    default: {
      create: vi.fn(() => ({ request })),
      isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
    },
    create: vi.fn(() => ({ request })),
    isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean })?.isAxiosError),
    __request: request,
  };
});

describe("api service", () => {
  const getRequestMock = () => (axiosModule as unknown as { __request: ReturnType<typeof vi.fn> }).__request;

  beforeEach(() => {
    getRequestMock().mockReset();
  });

  it("returns payload from response.data.data", async () => {
    const payload = { updatedAt: null, gates: [], doors: [], error: null };

    getRequestMock().mockResolvedValue({
      data: {
        data: payload,
        message: null,
        errors: null,
      },
    });

    await expect(api.controlStatus()).resolves.toEqual(payload);
  });

  it("maps axios http error with status and payload", async () => {
    getRequestMock().mockRejectedValue({
      isAxiosError: true,
      message: "Bad Gateway",
      response: {
        status: 502,
        data: { message: "Falha no gateway" },
      },
    });

    await expect(api.controlStatus()).rejects.toMatchObject({
      message: "Falha no gateway",
      status: 502,
      payload: { message: "Falha no gateway" },
    });
  });
});
