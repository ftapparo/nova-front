import { beforeAll, describe, expect, it } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { FakeWebSocket, installFakeWebSocket, lastSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";
import { placeLabel, type CieLog, type Panel } from "./fireApi";

const situation = (state: "normal" | "alarme", silenced = false) =>
  state === "alarme"
    ? { state, label: "Sistema em alarme", severity: "critical" as const, silenced }
    : { state, label: "Sistema normal", severity: "ok" as const, silenced };

const panel = (overrides: Partial<Panel> = {}): Panel => ({
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
  counters: { alarme: 0, falha: 1, supervisao: 0, bloqueio: 2, regrasTemporizando: 0 },
  leds: {},
  latestFailureEvent: null,
  latestAlarmEvent: null,
  situation: situation("normal"),
  ...overrides,
});

const log = (overrides: { key: string; title: string; kind?: CieLog["event"]["kind"] }) =>
  ({
    key: overrides.key,
    occurredAt: "2026-11-15T13:30:00.000Z",
    source: "ativo",
    event: { category: "falha", code: 7, label: overrides.title, kind: overrides.kind ?? "ativacao", severity: "warning" },
    display: {
      title: overrides.title,
      device: "Sensor de Fumaça",
      deviceName: "16 ANDAR B T-B",
      place: {
        tower: "B",
        towerLabel: "Torre B",
        floor: 16,
        floorLabel: "16º andar",
        position: "B",
        positionLabel: "Posição B",
        area: null,
        areaDetail: null,
      },
      rule: null,
      loop: 1,
      address: 100,
      zone: 4,
      zoneName: "TORRE B",
    },
  }) as unknown as CieLog;

type Routes = Parameters<typeof fakeApi>[0];

const openPage = (routes: Routes = {}): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ role: "porteiro" });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => okResponse({ ticket: "t-1", expiresIn: 30 }),
    "GET /cie/panel": () => okResponse(panel()),
    "GET /cie/events/active": () =>
      okResponse({
        counters: { alarme: 0, falha: 1, supervisao: 0, bloqueio: 2 },
        situation: situation("normal"),
        events: { alarme: [], falha: [log({ key: "f1", title: "Disp. em Falha" })], supervisao: [], bloqueio: [] },
      }),
    "GET /cie/logs": ({ query }) =>
      okResponse({
        type: query.get("type"),
        limit: 30,
        cursor: query.get("cursor"),
        nextCursor: query.get("cursor") ? null : "c-2",
        items: [log({ key: `h-${query.get("cursor") ?? "1"}`, title: query.get("cursor") ? "Registro antigo" : "Alarme", kind: "restauracao" })],
      }),
    "GET /cie/installation": () =>
      okResponse({
        model: "CIE2500",
        firmware: null,
        installation: "NOVA RESIDENCE",
        zones: [],
        rules: [],
        devices: [
          { loop: 1, address: 100, name: "16 ANDAR B T-B", device: "Sensor de Fumaça", type: 1, subtype: 0, zone: 4, zoneName: "TORRE B", enabled: true, localOutput: null, place: null },
          { loop: 1, address: 101, name: "ELEVADOR 1", device: "Acionador Manual", type: 2, subtype: 0, zone: 9, zoneName: "ELEVADORES", enabled: true, localOutput: null, place: null },
        ],
      }),
    "GET /cie/counters/blocks": () => okResponse({ dispositivo: 2, sirene: 0, zona: 1 }),
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp("/incendio");
  return requests;
};

describe("placeLabel", () => {
  it("junta os rótulos de local prontos da API", () => {
    expect(
      placeLabel({ tower: "B", towerLabel: "Torre B", floor: 16, floorLabel: "16º andar", position: "B", positionLabel: "Posição B", area: null, areaDetail: null }),
    ).toBe("Torre B · 16º andar · Posição B");
    expect(
      placeLabel({ tower: null, towerLabel: null, floor: -2, floorLabel: "Subsolo 2", position: null, positionLabel: null, area: "Garagem", areaDetail: "2 C" }),
    ).toBe("Garagem · 2 C");
    expect(placeLabel(null)).toBeNull();
  });
});

describe("Central de Incêndio", () => {
  beforeAll(async () => {
    await import("./FirePage");
  });

  it("mostra a situação, os contadores e os eventos ativos", async () => {
    openPage();

    expect(await screen.findByRole("status")).toHaveTextContent("Sistema normal");
    const counters = screen.getByLabelText("Contadores da central");
    expect(within(counters).getByText("Bloqueio").previousSibling).toHaveTextContent("2");
    expect(await screen.findByRole("tab", { name: "Falha (1)" })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("tab", { name: "Falha (1)" }));
    expect(await screen.findByText("Disp. em Falha")).toBeInTheDocument();
    expect(screen.getAllByText("Torre B · 16º andar · Posição B · Zona 4 TORRE B · Laço 1 · endereço 100").length).toBeGreaterThan(0);
  });

  it("mostra os bloqueios pelos contadores, já que a central não lista quais são", async () => {
    const user = userEvent.setup();
    openPage();

    await user.click(await screen.findByRole("tab", { name: "Bloqueio (2)" }));

    expect(await screen.findByText("Dispositivos")).toBeInTheDocument();
    expect(screen.getByText("Zonas")).toBeInTheDocument();
    expect(screen.queryByText("Sirenes")).not.toBeInTheDocument();
  });

  it("pagina o histórico pelo cursor e filtra só ocorrências", async () => {
    const user = userEvent.setup();
    const requests = openPage();

    expect(await screen.findByText("Alarme", { selector: "p" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Carregar mais" }));
    expect(await screen.findByText("Registro antigo")).toBeInTheDocument();
    expect(requests.filter((request) => request.path === "/cie/logs").at(-1)?.query.get("cursor")).toBe("c-2");

    await user.click(screen.getByLabelText("Só ocorrências"));
    await waitFor(() =>
      expect(requests.some((request) => request.path === "/cie/logs" && request.query.get("kind") === "ativacao")).toBe(true),
    );
  });

  it("dispara o alarme geral só depois da segunda confirmação, com confirm: true", async () => {
    const user = userEvent.setup();
    const requests = openPage({
      "POST /cie/commands/alarm-general": () => okResponse({ action: "alarm-general", snapshot: {} }),
    });

    await user.click(await screen.findByRole("button", { name: "Disparar alarme geral" }));
    expect(requests.some((request) => request.path === "/cie/commands/alarm-general")).toBe(false);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Disparar alarme geral" }));

    expect(await screen.findByText("Alarme geral disparado.")).toBeInTheDocument();
    expect(requests.find((request) => request.path === "/cie/commands/alarm-general")?.body).toEqual({ confirm: true });
  });

  it("alterna silenciar e reativar sirenes pelo LED da central", async () => {
    const user = userEvent.setup();
    const requests = openPage({
      "GET /cie/panel": () => okResponse(panel({ leds: { sireneSilenciada: true } })),
      "POST /cie/commands/release-siren": () => okResponse({ action: "release-siren", snapshot: {} }),
    });

    await user.click(await screen.findByRole("button", { name: "Reativar sirenes" }));

    expect(await screen.findByText("Sirenes reativadas.")).toBeInTheDocument();
    expect(requests.find((request) => request.path === "/cie/commands/release-siren")?.body).toEqual({});
  });

  it("mostra a recusa da central sem repetir o comando", async () => {
    const user = userEvent.setup();
    const requests = openPage({
      "POST /cie/commands/silence-bip": () => errorResponse("conflict", 409, "A central recusou o comando."),
    });

    await user.click(await screen.findByRole("button", { name: "Silenciar bip" }));

    expect(await screen.findByText("A central recusou o comando.")).toBeInTheDocument();
    expect(requests.filter((request) => request.path === "/cie/commands/silence-bip")).toHaveLength(1);
  });

  it("trava os comandos com a central sem comunicação", async () => {
    openPage({ "GET /cie/panel": () => okResponse(panel({ online: false })) });

    expect(await screen.findByRole("button", { name: "Silenciar bip" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disparar alarme geral" })).toBeDisabled();
  });

  it("recarrega a situação quando chega evento da central", async () => {
    let state: "normal" | "alarme" = "normal";
    openPage({ "GET /cie/panel": () => okResponse(panel({ situation: situation(state) })) });
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    act(() => lastSocket().serverOpen());
    expect(await screen.findByRole("status")).toHaveTextContent("Sistema normal");

    state = "alarme";
    act(() => lastSocket().serverSend({ event: "cie.alarm.triggered", data: {} }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sistema em alarme"));
  });

  it("busca dispositivos da instalação sem diferenciar acento", async () => {
    const user = userEvent.setup();
    openPage();

    const table = await screen.findByRole("table", { name: "Dispositivos da central" });
    expect(within(table).getByText("ELEVADOR 1")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Buscar dispositivo"), "fumaca");

    await waitFor(() => expect(within(table).queryByText("ELEVADOR 1")).not.toBeInTheDocument());
    expect(within(table).getByText("16 ANDAR B T-B")).toBeInTheDocument();
  });
});
