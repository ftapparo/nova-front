import { beforeAll, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { installFakeWebSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";
import { sanitizeShortcuts } from "./shortcuts";

type Routes = Parameters<typeof fakeApi>[0];

const exhaust = (id: string, on: boolean, moduleOnline = true) => ({
  id,
  tower: id[0],
  final: Number(id.slice(1)),
  on,
  expiresAt: null,
  processStatus: null,
  moduleOnline,
  command: null,
  maintenance: false,
});

const openPage = (routes: Routes = {}) => {
  installFakeWebSocket();
  const user = sessionUser({ role: "porteiro" });
  let settings = { updatedAt: 0, items: { "app.tema": "escuro" } as Record<string, string>, exists: true };
  const requests: FakeRequest[] = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => okResponse({ ticket: "t-1", expiresIn: 30 }),
    "GET /cie/panel": () =>
      okResponse({
        online: true,
        connected: true,
        restarting: false,
        central: { nome: "NOVA RESIDENCE", modelo: "CIE2500" },
        counters: { alarme: 0, falha: 2, supervisao: 0, bloqueio: 0, regrasTemporizando: 0 },
        situation: { state: "falha", label: "Sistema em falha", severity: "warning", silenced: false },
      }),
    "GET /tag/gates": () => okResponse([{ numeroDispositivo: 9, nome: "PORTÃO ENTRADA", sentido: "E", ativo: true }]),
    "GET /tag/status": () => okResponse({ updatedAt: null, gates: [{ numeroDispositivo: 9, nome: "PORTÃO ENTRADA", sentido: "E", online: true }] }),
    "GET /doors": () => okResponse([{ id: 1, nome: "PORTA SOCIAL", porta: 80, ativo: true }]),
    "GET /doors/status": () => okResponse({ updatedAt: null, doors: [{ id: 1, nome: "PORTA SOCIAL", porta: 80, online: false }] }),
    "GET /exhausts": () => okResponse([exhaust("A1", true), exhaust("A5", false, false)]),
    "GET /commands/logs": () =>
      okResponse([
        { id: "1", timestamp: "2026-11-15T13:00:00.000Z", requestId: null, method: "POST", path: "/v3/api/doors/1/open", command: "POST /v3/api/doors/1/open", status: 502, actor: "portaria@novaresidence.com.br" },
      ]),
    "GET /access/recent": () =>
      okResponse([{ NOME: "FULANO DE TAL", TORRE: "A", APARTAMENTO: "124", DATAHORA: "2026-11-15T10:00:00", SENTIDO: "E" }]),
    "GET /me/settings": () => okResponse(settings),
    "PUT /me/settings": ({ body }) => {
      settings = { ...(body as typeof settings), exists: true };
      return okResponse(settings);
    },
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp("/");
  return requests;
};

describe("sanitizeShortcuts", () => {
  it("descarta o que não tem o formato de atalho", () => {
    expect(
      sanitizeShortcuts([
        { id: "a", kind: "door", target: 1, label: "" },
        { id: "b", kind: "elevador", target: 1, label: "" },
        { id: "c", kind: "gate", target: "9", label: "" },
        null,
      ]),
    ).toEqual([{ id: "a", kind: "door", target: 1, label: "" }]);
    expect(sanitizeShortcuts("lixo")).toEqual([]);
  });
});

describe("Painel Operacional", () => {
  beforeAll(async () => {
    await import("./DashboardPage");
  });

  it("resume a central, os equipamentos fora do ar e os exaustores ligados", async () => {
    openPage();

    expect(await screen.findByText("Sistema em falha")).toBeInTheDocument();
    expect(screen.getByText("Alarme 0 · Falha 2 · Supervisão 0")).toBeInTheDocument();
    // Porta sem comunicação + módulo A_58 fora do ar.
    expect(await screen.findByText("2 fora do ar")).toBeInTheDocument();
    expect(screen.getByText("1 ligado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Central de incêndio/ })).toHaveAttribute("href", "/incendio");
  });

  it("mostra as últimas passagens e os últimos comandos", async () => {
    openPage();

    const passages = await screen.findByRole("list", { name: "Últimas passagens" });
    expect(within(passages).getByText("FULANO DE TAL · A-124")).toBeInTheDocument();
    const commands = await screen.findByRole("list", { name: "Últimos comandos" });
    expect(within(commands).getByText("Porta aberta · Porta 1")).toBeInTheDocument();
    expect(within(commands).getByText("Falhou")).toBeInTheDocument();
  });

  it("cria atalhos na conta sem apagar as preferências do aplicativo, e a porta abre direto", async () => {
    const user = userEvent.setup();
    const requests = openPage({ "POST /doors/1/open": () => okResponse({ id: 1, nome: "PORTA SOCIAL", porta: 80 }) });

    expect(await screen.findByText("Nenhum atalho")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Porta · PORTA SOCIAL" }));
    await user.type(within(dialog).getByLabelText("Nome (opcional)"), "Social");
    await user.click(within(dialog).getByRole("button", { name: "Adicionar" }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar atalhos" }));

    expect(await screen.findByText("Atalhos salvos.")).toBeInTheDocument();
    const saved = requests.find((request) => request.method === "PUT")?.body as { items: Record<string, string> };
    expect(saved.items["app.tema"]).toBe("escuro");
    expect(JSON.parse(saved.items["painel.atalhos"]!)).toEqual([
      { id: expect.any(String), kind: "door", target: 1, label: "Social" },
    ]);

    await user.click(await screen.findByRole("button", { name: "Abrir Social" }));
    expect(await screen.findByText("Social: aberta.")).toBeInTheDocument();
  });

  it("atalho de portão leva à conferência do CPF com o portão escolhido", async () => {
    openPage({
      "GET /me/settings": () =>
        okResponse({
          updatedAt: 1,
          exists: true,
          items: { "painel.atalhos": JSON.stringify([{ id: "x", kind: "gate", target: 9, label: "" }]) },
        }),
    });

    expect(await screen.findByRole("link", { name: "Abrir PORTÃO ENTRADA" })).toHaveAttribute("href", "/portoes-portas?portao=9");
  });
});
