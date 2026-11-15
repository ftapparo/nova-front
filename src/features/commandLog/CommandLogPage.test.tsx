import { beforeAll, describe, expect, it } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { FakeWebSocket, installFakeWebSocket, lastSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";
import { commandLabel, commandTarget, type CommandLog } from "./commandLogApi";

const entry = (overrides: Partial<CommandLog>): CommandLog => ({
  id: "1",
  timestamp: "2026-11-15T13:00:00.000Z",
  requestId: null,
  method: "POST",
  path: "/v3/api/tag/gate/open",
  command: "POST /v3/api/tag/gate/open",
  status: 200,
  actor: "portaria@novaresidence.com.br",
  ip: null,
  ...overrides,
});

const openPage = (logs: CommandLog[]): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ role: "porteiro" });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => okResponse({ ticket: "t-1", expiresIn: 30 }),
    "GET /commands/logs": () => okResponse(logs),
  });
  startSession(sessionData({ user }));
  renderApp("/comandos");
  return requests;
};

describe("rótulos do histórico", () => {
  it("reconhece os caminhos da v2 e da v3", () => {
    expect(commandLabel(entry({ path: "/v2/api/control/door/open" }))).toBe("Porta aberta");
    expect(commandLabel(entry({ path: "/v3/api/doors/3/open" }))).toBe("Porta aberta");
    expect(commandLabel(entry({ path: "/v3/api/tag/gate/close" }))).toBe("Portão fechado");
    expect(commandLabel(entry({ path: "/v2/api/exhausts/on" }))).toBe("Exaustor ligado");
    expect(commandLabel(entry({ path: "/v3/api/exhausts/A4/off" }))).toBe("Exaustor desligado");
    expect(commandLabel(entry({ path: "/v3/api/exhausts/A4/maintenance", method: "PUT" }))).toBe("Manutenção de exaustor");
    expect(commandLabel(entry({ path: "/v3/api/cie/commands/alarm-general" }))).toBe("Alarme geral disparado");
    expect(commandLabel(entry({ path: "/v3/api/qualquer", method: "DELETE" }))).toBe("Remoção");
  });

  it("aponta o equipamento quando o caminho diz qual é", () => {
    expect(commandTarget(entry({ path: "/v3/api/exhausts/a4/on" }))).toBe("Exaustor A4");
    expect(commandTarget(entry({ path: "/v3/api/doors/3/open" }))).toBe("Porta 3");
    expect(commandTarget(entry({}))).toBeNull();
  });
});

describe("Histórico de comandos", () => {
  beforeAll(async () => {
    await import("./CommandLogPage");
  });

  it("lista os comandos com ação, quem enviou e o resultado", async () => {
    const requests = openPage([
      entry({ id: "2", path: "/v3/api/exhausts/A4/on", command: "POST /v3/api/exhausts/A4/on" }),
      entry({ id: "1", status: 409, actor: "desconhecido" }),
    ]);

    const table = await screen.findByRole("table", { name: "Histórico de comandos" });
    expect(within(table).getByText("Exaustor ligado · Exaustor A4")).toBeInTheDocument();
    expect(within(table).getByText("Falhou (409)")).toBeInTheDocument();
    expect(within(table).getByText("Não identificado")).toBeInTheDocument();
    expect(requests.find((request) => request.path === "/commands/logs")?.query.get("limit")).toBe("50");
  });

  it("filtra só as falhas", async () => {
    const user = userEvent.setup();
    openPage([entry({ id: "2", path: "/v3/api/exhausts/A4/on" }), entry({ id: "1", status: 502 })]);

    await screen.findByText("Exaustor ligado · Exaustor A4");
    await user.click(screen.getByLabelText("Só falhas"));

    await waitFor(() => expect(screen.queryByText("Exaustor ligado · Exaustor A4")).not.toBeInTheDocument());
    expect(screen.getByText("Falhou (502)")).toBeInTheDocument();
  });

  it("acrescenta no topo o comando que chega pelo tempo real", async () => {
    openPage([entry({ id: "1" })]);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    act(() => lastSocket().serverOpen());
    await screen.findByText("Portão aberto");

    act(() =>
      lastSocket().serverSend({ event: "command.logged", data: entry({ id: "9", path: "/v3/api/cie/commands/silence-bip" }) }),
    );

    const table = await screen.findByRole("table", { name: "Histórico de comandos" });
    await waitFor(() => expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Bip da central silenciado"));
  });
});
