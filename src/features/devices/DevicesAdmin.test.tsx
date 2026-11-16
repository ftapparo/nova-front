import { beforeAll, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { installFakeWebSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";

type Routes = Parameters<typeof fakeApi>[0];

const cacheList = {
  type: "all",
  items: [
    {
      tag: "0001234567",
      validatedAt: "2026-11-16T13:00:00.000Z",
      isValid: true,
      verifyData: { NOME: "FULANO DE TAL", QUADRA: "A", LOTE: "124" },
    },
    { tag: "0009998887", validatedAt: "2026-11-16T13:01:00.000Z", isValid: false },
  ],
  stats: { positiveSize: 1, negativeSize: 1, positiveTimeout: 300000, negativeTimeout: 60000 },
};

const openPage = (role: "porteiro" | "sindico" | "admin", routes: Routes = {}): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ role });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => errorResponse("upstream-error", 503, null),
    "GET /tag/gates": () => okResponse([{ numeroDispositivo: 9, nome: "PORTÃO ENTRADA", sentido: "E", ativo: true }]),
    "GET /tag/status": () => okResponse({ updatedAt: null, gates: [] }),
    "GET /doors": () => okResponse([]),
    "GET /doors/status": () => okResponse({ updatedAt: null, doors: [] }),
    "GET /exhausts": () => okResponse([]),
    "GET /cie/panel": () => errorResponse("upstream-error", 502, null),
    "GET /tag/cache": () => okResponse(cacheList),
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp("/equipamentos");
  return requests;
};

describe("Equipamentos: cache de TAGs e módulos", () => {
  beforeAll(async () => {
    await import("./DevicesPage");
  });

  it("mostra o cache da antena com a pessoa de cada TAG e o tempo de guarda", async () => {
    const requests = openPage("porteiro");

    const table = await screen.findByRole("table", { name: "Cache de TAGs" });
    const first = within(table).getByText("0001234567").closest("tr") as HTMLElement;
    expect(within(first).getByText("Liberada")).toBeInTheDocument();
    expect(within(first).getByText("FULANO DE TAL")).toBeInTheDocument();
    expect(within(first).getByText("A-124")).toBeInTheDocument();
    expect(screen.getByText("1 liberada(s) por 5 min · 1 recusada(s) por 1 min")).toBeInTheDocument();
    expect(Object.fromEntries(requests.find((request) => request.path === "/tag/cache")?.query ?? [])).toEqual({
      numeroDispositivo: "9",
      type: "all",
    });
  });

  it("porteiro só consulta: sem remover, limpar nem configurar módulo", async () => {
    openPage("porteiro");

    await screen.findByRole("table", { name: "Cache de TAGs" });
    expect(screen.queryByRole("button", { name: "Limpar cache" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
    expect(screen.queryByText("Configuração de módulo de exaustor")).not.toBeInTheDocument();
  });

  it("síndico remove uma TAG do cache depois de confirmar", async () => {
    const user = userEvent.setup();
    const requests = openPage("sindico", { "DELETE /tag/cache/0001234567": () => okResponse({ tag: "0001234567" }) });

    const table = await screen.findByRole("table", { name: "Cache de TAGs" });
    await user.click(within(within(table).getByText("0001234567").closest("tr") as HTMLElement).getByRole("button", { name: "Remover" }));
    expect(requests.some((request) => request.method === "DELETE")).toBe(false);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remover" }));

    expect(await screen.findByText("TAG 0001234567 removida do cache.")).toBeInTheDocument();
    expect(requests.find((request) => request.method === "DELETE")?.query.get("numeroDispositivo")).toBe("9");
  });

  it("síndico limpa o cache depois de confirmar", async () => {
    const user = userEvent.setup();
    const requests = openPage("sindico", {
      "DELETE /tag/cache": () => okResponse({ type: "all", stats: { ...cacheList.stats, positiveSize: 0, negativeSize: 0 } }),
    });

    await user.click(await screen.findByRole("button", { name: "Limpar cache" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Limpar" }));

    expect(await screen.findByText("Cache limpo.")).toBeInTheDocument();
    expect(Object.fromEntries(requests.find((request) => request.method === "DELETE")?.query ?? [])).toEqual({ numeroDispositivo: "9", type: "all" });
  });

  it("admin envia comando ao módulo só depois de confirmar e vê a resposta", async () => {
    const user = userEvent.setup();
    const requests = openPage("admin", { "POST /exhausts/modules/B_58/config": () => okResponse({ PulseTime1: 0 }) });

    await screen.findByText("Configuração de módulo de exaustor");
    await user.click(screen.getByRole("combobox", { name: "Módulo" }));
    await user.click(await screen.findByRole("option", { name: "B_58" }));
    await user.type(screen.getByLabelText("Comando"), "PulseTime1%200");
    await user.click(screen.getByRole("button", { name: "Enviar ao módulo" }));
    expect(requests.some((request) => request.path.startsWith("/exhausts/modules"))).toBe(false);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Enviar" }));

    expect(await screen.findByLabelText("Resposta do módulo")).toHaveTextContent('"PulseTime1": 0');
    expect(requests.find((request) => request.path === "/exhausts/modules/B_58/config")?.body).toEqual({ comando: "PulseTime1%200" });
  });
});
