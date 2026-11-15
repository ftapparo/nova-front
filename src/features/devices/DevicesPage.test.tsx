import { beforeAll, describe, expect, it } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import { startSession } from "@/core/session/sessionStore";
import { fakeApi, okResponse, sessionData, sessionUser } from "@/test/fakeApi";
import { FakeWebSocket, installFakeWebSocket, lastSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";
import type { Exhaust } from "@/features/exhaust/exhaustApi";
import { groupExhaustModules } from "./devicesStatus";

const exhaust = (id: string, moduleOnline = true): Exhaust => ({
  id,
  tower: id[0]!,
  final: Number(id.slice(1)),
  on: false,
  expiresAt: null,
  processStatus: null,
  moduleOnline,
  command: null,
  maintenance: false,
});

describe("groupExhaustModules", () => {
  it("junta os exaustores pelo módulo da torre e marca o módulo fora do ar", () => {
    const modules = groupExhaustModules([exhaust("A1"), exhaust("A4", false), exhaust("A5"), exhaust("B8")]);

    expect(modules.map(({ id, online, exhaustIds }) => ({ id, online, exhaustIds }))).toEqual([
      { id: "A_14", online: false, exhaustIds: ["A1", "A4"] },
      { id: "A_58", online: true, exhaustIds: ["A5"] },
      { id: "B_58", online: true, exhaustIds: ["B8"] },
    ]);
  });
});

describe("Equipamentos", () => {
  beforeAll(async () => {
    await import("./DevicesPage");
  });

  it("mostra a comunicação de cada tipo de equipamento e recarrega com os avisos do tempo real", async () => {
    installFakeWebSocket();
    let doorOnline = true;
    const user = sessionUser({ role: "porteiro" });
    fakeApi({
      "GET /auth/me": () => okResponse(user),
      "POST /ws/ticket": () => okResponse({ ticket: "t-1", expiresIn: 30 }),
      "GET /tag/gates": () => okResponse([{ numeroDispositivo: 9, nome: "PORTÃO ENTRADA", sentido: "E", ativo: true }]),
      "GET /tag/status": () =>
        okResponse({ updatedAt: "2026-11-15T13:00:00.000Z", gates: [{ numeroDispositivo: 9, nome: "PORTÃO ENTRADA", sentido: "E", online: false }] }),
      "GET /doors": () => okResponse([{ id: 1, nome: "PORTA SOCIAL", porta: 80, ativo: true }]),
      "GET /doors/status": () => okResponse({ updatedAt: null, doors: [{ id: 1, nome: "PORTA SOCIAL", porta: 80, online: doorOnline }] }),
      "GET /exhausts": () => okResponse([exhaust("A1"), exhaust("A5", false)]),
      "GET /cie/panel": () =>
        okResponse({
          online: true,
          connected: true,
          restarting: false,
          central: { nome: "NOVA RESIDENCE", modelo: "CIE2500" },
          situation: { state: "normal", label: "Sistema normal", severity: "ok", silenced: false },
        }),
    });
    startSession(sessionData({ user }));
    renderApp("/equipamentos");

    const gatesList = await screen.findByRole("list", { name: "Portões" });
    expect(within(gatesList).getByText("Sem comunicação")).toBeInTheDocument();
    const modules = await screen.findByRole("list", { name: "Módulos de exaustores" });
    expect(within(modules).getByText("A_58").closest("li")).toHaveTextContent("Sem comunicação");
    expect(within(await screen.findByRole("list", { name: "Central de incêndio" })).getByText("Sistema normal")).toBeInTheDocument();
    const doorsList = await screen.findByRole("list", { name: "Portas" });
    expect(within(doorsList).getByText("Online")).toBeInTheDocument();

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    act(() => lastSocket().serverOpen());
    doorOnline = false;
    act(() => lastSocket().serverSend({ event: "devices.status.changed", data: { updatedAt: null, doors: [{ id: 1, online: false }] } }));

    await waitFor(() => expect(within(doorsList).getByText("Sem comunicação")).toBeInTheDocument());
  });
});
