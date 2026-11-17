import { beforeAll, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { installFakeWebSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";

type Routes = Parameters<typeof fakeApi>[0];

const panel = {
  online: true,
  connected: true,
  restarting: false,
  restartingUntil: null,
  reconnecting: false,
  reconnectAttempt: 0,
  lastError: null,
  lastUpdated: null,
  central: { ip: null, endereco: 1, nome: "NOVA RESIDENCE", modelo: "CIE2500", mac: null },
  dataHora: null,
  counters: { alarme: 0, falha: 0, supervisao: 0, bloqueio: 0, regrasTemporizando: 0 },
  leds: {},
  latestFailureEvent: null,
  latestAlarmEvent: null,
  situation: { state: "normal", label: "Sistema normal", severity: "ok", silenced: false },
};

const installation = {
  model: "CIE2500",
  firmware: null,
  installation: "NOVA RESIDENCE",
  zones: [{ id: 4, name: "TORRE B", enabled: true, place: null }],
  rules: [{ id: 7, name: "TORRE C", enabled: true, inputs: [], outputs: [] }],
  devices: [
    { loop: 1, address: 100, name: "16 ANDAR B T-B", device: "Sensor de Fumaça", type: 1, subtype: 0, zone: 4, zoneName: "TORRE B", enabled: true, localOutput: null, place: null },
    { loop: 2, address: 12, name: "SIRENE TERREO", device: "Sirene", type: 3, subtype: 0, zone: 9, zoneName: "GERAL", enabled: true, localOutput: "S1", place: null },
  ],
};

const openPage = (role: "porteiro" | "sindico" | "admin", routes: Routes = {}): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ role });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => errorResponse("upstream-error", 503, null),
    "GET /cie/panel": () => okResponse(panel),
    "GET /cie/events/active": () =>
      okResponse({ counters: { alarme: 0, falha: 0, supervisao: 0, bloqueio: 0 }, situation: panel.situation, events: { alarme: [], falha: [], supervisao: [], bloqueio: [] } }),
    "GET /cie/logs": () => okResponse({ type: "alarme", limit: 30, cursor: null, nextCursor: null, items: [] }),
    "GET /cie/installation": () => okResponse(installation),
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp("/incendio");
  return requests;
};

describe("Central de Incêndio: bloqueios e saídas", () => {
  beforeAll(async () => {
    await import("./FirePage");
  });

  it("só o admin vê bloqueios e saídas", async () => {
    openPage("sindico");

    await screen.findByRole("button", { name: "Silenciar bip" });
    await screen.findByRole("table", { name: "Dispositivos da central" });
    expect(screen.queryByText("Bloqueios e saídas")).not.toBeInTheDocument();
  });

  it("admin bloqueia um dispositivo escolhido pelo nome, só depois de confirmar", async () => {
    const user = userEvent.setup();
    const requests = openPage("admin", { "POST /cie/commands/block": () => okResponse({ action: "block", payload: {}, response: {}, snapshot: {} }) });

    const card = (await screen.findByText("Bloqueios e saídas")).closest("section") as HTMLElement;
    await user.click(within(card).getByRole("combobox", { name: "Dispositivo" }));
    await user.click(await screen.findByRole("option", { name: /1\.100 · 16 ANDAR B T-B · Sensor de Fumaça/ }));
    await user.click(within(card).getByRole("button", { name: "Enviar à central" }));
    expect(requests.some((request) => request.path === "/cie/commands/block")).toBe(false);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("Bloqueado: 1.100 · 16 ANDAR B T-B · Sensor de Fumaça.")).toBeInTheDocument();
    expect(requests.find((request) => request.path === "/cie/commands/block")?.body).toEqual({ tipoBloqueio: 0, laco: 1, numero: 100, bloquear: 1 });
  });

  it("admin desbloqueia uma zona pelo número dela", async () => {
    const user = userEvent.setup();
    const requests = openPage("admin", { "POST /cie/commands/block": () => okResponse({ action: "block", payload: {}, response: {}, snapshot: {} }) });

    const card = (await screen.findByText("Bloqueios e saídas")).closest("section") as HTMLElement;
    await user.click(within(card).getByRole("combobox", { name: "O que bloquear" }));
    await user.click(await screen.findByRole("option", { name: "Zona" }));
    await user.click(within(card).getByRole("combobox", { name: "Zona" }));
    await user.click(await screen.findByRole("option", { name: "Zona 4 · TORRE B" }));
    await user.click(within(card).getByRole("button", { name: "Desbloquear" }));
    await user.click(within(card).getByRole("button", { name: "Enviar à central" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirmar" }));

    await screen.findByText("Desbloqueado: Zona 4 · TORRE B.");
    expect(requests.find((request) => request.path === "/cie/commands/block")?.body).toEqual({ tipoBloqueio: 1, laco: 0, numero: 4, bloquear: 0 });
  });

  it("admin aciona uma saída e vê a recusa da central sem repetir", async () => {
    const user = userEvent.setup();
    const requests = openPage("admin", { "POST /cie/commands/output": () => errorResponse("conflict", 409, "A central recusou o comando.") });

    const card = (await screen.findByText("Bloqueios e saídas")).closest("section") as HTMLElement;
    await user.click(within(card).getByRole("tab", { name: "Acionar saída" }));
    await user.click(within(card).getByRole("combobox", { name: "Dispositivo de saída" }));
    await user.click(await screen.findByRole("option", { name: /2\.12 · SIRENE TERREO/ }));
    await user.click(within(card).getByRole("button", { name: "Enviar à central" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("A central recusou o comando.")).toBeInTheDocument();
    expect(requests.filter((request) => request.path === "/cie/commands/output")).toHaveLength(1);
    expect(requests.find((request) => request.path === "/cie/commands/output")?.body).toEqual({ laco: 2, numero: 12, ativo: 1 });
  });
});
