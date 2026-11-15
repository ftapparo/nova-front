import { beforeAll, describe, expect, it } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { FakeWebSocket, installFakeWebSocket, lastSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";
import { formatErpDateTime, unitLabel } from "./accessFormat";

const gates = [
  { numeroDispositivo: 9, nome: "PORTÃO ENTRADA", sentido: "E", ativo: true },
  { numeroDispositivo: 10, nome: "PORTÃO SAÍDA", sentido: "S", ativo: true },
];

const passage = (overrides: Record<string, unknown>) => ({
  NOME: "FULANO DE TAL",
  TORRE: "A",
  APARTAMENTO: "124",
  DATAHORA: "2026-11-15T10:00:00",
  DISPOSITIVO: 9,
  SENTIDO: "E",
  DESCRICAO: "MORADOR",
  IDACESSO: "0001234567",
  VEICULO: null,
  ...overrides,
});

type Routes = Parameters<typeof fakeApi>[0];

const openPage = (routes: Routes = {}): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ role: "porteiro" });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => okResponse({ ticket: "t-1", expiresIn: 30 }),
    "GET /tag/gates": () => okResponse(gates),
    "GET /access/recent": ({ query }) =>
      okResponse(
        query.get("numeroDispositivo") === "9"
          ? [passage({ NOME: "ENTRADA ANTIGA", DATAHORA: "2026-11-15T09:00:00" })]
          : [passage({ NOME: "SAÍDA RECENTE", DATAHORA: "2026-11-15T11:30:05", SENTIDO: "S", DISPOSITIVO: 10 })],
      ),
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp("/acessos");
  return requests;
};

const passageRows = () =>
  within(screen.getByRole("table", { name: "Últimas passagens" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => row.textContent);

describe("formatação do ERP", () => {
  it("mostra a data e hora do ERP sem aplicar fuso", () => {
    expect(formatErpDateTime("2026-11-15T23:59:07")).toBe("15/11/2026 23:59:07");
    expect(formatErpDateTime("2026-11-15 08:05")).toBe("15/11/2026 08:05:00");
    expect(formatErpDateTime(null)).toBe("—");
  });

  it("monta a unidade e ignora o zero que o ERP usa como vazio", () => {
    expect(unitLabel("A", "124")).toBe("A-124");
    expect(unitLabel("0", "0")).toBe("—");
  });
});

describe("Acessos", () => {
  beforeAll(async () => {
    await import("./AccessPage");
  });

  it("junta as passagens dos portões, da mais recente para a mais antiga", async () => {
    const requests = openPage();

    await screen.findByText("SAÍDA RECENTE");
    expect(passageRows()).toEqual([
      expect.stringContaining("15/11/2026 11:30:05PORTÃO SAÍDASaídaSAÍDA RECENTE"),
      expect.stringContaining("15/11/2026 09:00:00PORTÃO ENTRADAEntradaENTRADA ANTIGA"),
    ]);
    const recent = requests.filter((request) => request.path === "/access/recent");
    expect(recent.map((request) => request.query.get("limit"))).toEqual(["20", "20"]);
  });

  it("filtra por portão", async () => {
    const user = userEvent.setup();
    openPage();
    await screen.findByText("SAÍDA RECENTE");

    await user.click(screen.getAllByRole("combobox")[0]!);
    await user.click(await screen.findByRole("option", { name: "PORTÃO ENTRADA" }));

    await waitFor(() => expect(screen.queryByText("SAÍDA RECENTE")).not.toBeInTheDocument());
    expect(screen.getByText("ENTRADA ANTIGA")).toBeInTheDocument();
  });

  it("avisa qual portão não carregou sem esconder os outros", async () => {
    openPage({
      "GET /access/recent": ({ query }) =>
        query.get("numeroDispositivo") === "9"
          ? errorResponse("upstream-error", 502, "Falha ao listar acessos.")
          : okResponse([passage({ NOME: "SAÍDA RECENTE" })]),
    });

    expect(await screen.findByText("SAÍDA RECENTE")).toBeInTheDocument();
    expect(await screen.findByText("Não foi possível carregar: PORTÃO ENTRADA.")).toBeInTheDocument();
  });

  it("confere uma credencial sem abrir nem registrar nada", async () => {
    const user = userEvent.setup();
    const requests = openPage({
      "GET /access/verify": () =>
        okResponse([
          { NOME: "FULANO DE TAL", QUADRA: "A", LOTE: "124", DESCRICAO: "MORADOR", DESCMIDIA: "TAG VEICULAR", PERMITIDO: "S", MOR: "S" },
        ]),
    });

    await user.type(await screen.findByLabelText("CPF, placa, TAG ou ID"), "ABC1D23");
    await user.click(screen.getByRole("button", { name: "Conferir" }));

    expect(await screen.findByText("A-124 · MORADOR · TAG VEICULAR")).toBeInTheDocument();
    expect(screen.getByText("Autorizado")).toBeInTheDocument();
    const verify = requests.find((request) => request.path === "/access/verify");
    expect(Object.fromEntries(verify?.query ?? [])).toEqual({ id: "ABC1D23", numeroDispositivo: "9", sentido: "E" });
    expect(requests.some((request) => request.method === "POST" && request.path !== "/ws/ticket")).toBe(false);
  });

  it("avisa quando a credencial não tem cadastro", async () => {
    const user = userEvent.setup();
    openPage({ "GET /access/verify": () => errorResponse("not-found", 404, "Credencial não encontrada.") });

    await user.type(await screen.findByLabelText("CPF, placa, TAG ou ID"), "0000000000");
    await user.click(screen.getByRole("button", { name: "Conferir" }));

    expect(await screen.findByText("Nenhum cadastro encontrado para esta credencial.")).toBeInTheDocument();
  });

  it("mostra as leituras ao vivo e antecipa a consulta das passagens do portão", async () => {
    const requests = openPage();
    await screen.findByText("SAÍDA RECENTE");
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    act(() => lastSocket().serverOpen());
    expect(await screen.findByText("Aguardando leituras")).toBeInTheDocument();
    const before = requests.filter((request) => request.path === "/access/recent").length;

    act(() =>
      lastSocket().serverSend({
        event: "tag.read",
        data: { numeroDispositivo: 10, tag: "0009998887", authorized: false, reason: "TAG bloqueada", direction: "S" },
      }),
    );

    const reads = await screen.findByRole("list", { name: "Leituras ao vivo" });
    expect(within(reads).getByText("0009998887")).toBeInTheDocument();
    expect(within(reads).getByText("Recusada")).toBeInTheDocument();
    expect(within(reads).getByText(/PORTÃO SAÍDA · TAG bloqueada/)).toBeInTheDocument();
    await waitFor(() =>
      expect(requests.filter((request) => request.path === "/access/recent").length).toBeGreaterThan(before),
    );
  });
});
