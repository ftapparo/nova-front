import { beforeAll, describe, expect, it } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { FakeWebSocket, installFakeWebSocket, lastSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";
import { exhaustPhase, remainingLabel, type Exhaust } from "./exhaustApi";

const exhaust = (overrides: Partial<Exhaust>): Exhaust => ({
  id: "A4",
  tower: "A",
  final: 4,
  on: false,
  expiresAt: null,
  processStatus: null,
  moduleOnline: true,
  command: null,
  maintenance: false,
  ...overrides,
});

type Routes = Parameters<typeof fakeApi>[0];

const openPage = (list: Exhaust[], role: "porteiro" | "sindico" = "porteiro", routes: Routes = {}): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ role });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => okResponse({ ticket: "t-1", expiresIn: 30 }),
    "GET /exhausts": () => okResponse(list),
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp("/exaustores");
  return requests;
};

const cardOf = async (id: string) => (await screen.findByRole("heading", { name: id })).closest(".MuiCard-root") as HTMLElement;

describe("regras de exaustor", () => {
  it("distingue ligando de desligando pelo último comando", () => {
    expect(exhaustPhase(exhaust({ processStatus: "iniciando", command: "ligar" }))).toBe("turning-on");
    expect(exhaustPhase(exhaust({ processStatus: "iniciando", command: "desligar", on: false }))).toBe("turning-off");
    expect(exhaustPhase(exhaust({ processStatus: "erro" }))).toBe("error");
    expect(exhaustPhase(exhaust({ on: true, processStatus: "executado" }))).toBe("on");
  });

  it("mostra quanto falta para desligar", () => {
    const now = new Date(2026, 10, 15, 20, 0, 0).getTime();
    expect(remainingLabel(now + 65 * 60_000, now)).toBe("Desliga às 21:05 (faltam 1 h 05 min)");
    expect(remainingLabel(now + 30_000, now)).toBe("Desliga às 20:00 (faltam 1 min)");
  });
});

describe("Exaustores", () => {
  beforeAll(async () => {
    await import("./ExhaustPage");
  });

  it("agrupa por torre e mostra a situação de cada exaustor", async () => {
    openPage([
      exhaust({ id: "B1", tower: "B", final: 1, moduleOnline: false }),
      exhaust({ id: "A4", on: true, expiresAt: Date.now() + 90 * 60_000 }),
      exhaust({ id: "A2", final: 2, maintenance: true }),
    ]);

    const towerA = await screen.findByRole("region", { name: "Torre A" });
    expect(within(towerA).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["A2", "A4"]);
    expect(within(await cardOf("A4")).getByText("Ligado")).toBeInTheDocument();
    expect(within(await cardOf("A4")).getByText(/Desliga às .* \(faltam 1 h 30 min\)/)).toBeInTheDocument();
    expect(within(await cardOf("A2")).getByText("Em manutenção")).toBeInTheDocument();
    expect(within(await cardOf("A2")).getByRole("button", { name: "Ligar" })).toBeDisabled();
    expect(within(await cardOf("B1")).getByText("Módulo offline")).toBeInTheDocument();
    expect(within(await cardOf("B1")).getByRole("button", { name: "Ligar" })).toBeDisabled();
  });

  it("liga com o tempo padrão de 3 horas", async () => {
    const user = userEvent.setup();
    const requests = openPage([exhaust({})], "porteiro", {
      "POST /exhausts/A4/on": () => okResponse(exhaust({ on: false, processStatus: "iniciando", command: "ligar" })),
    });

    await user.click(within(await cardOf("A4")).getByRole("button", { name: "Ligar" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Ligar" }));

    expect(await screen.findByText("Torre A · final 4: ligando.")).toBeInTheDocument();
    expect(requests.find((request) => request.path === "/exhausts/A4/on")?.body).toEqual({ minutes: 180 });
    expect(within(await cardOf("A4")).getByText("Ligando…")).toBeInTheDocument();
  });

  it("aceita outro tempo e recusa menos de 30 minutos", async () => {
    const user = userEvent.setup();
    const requests = openPage([exhaust({})], "porteiro", {
      "POST /exhausts/A4/on": () => okResponse(exhaust({ on: true, expiresAt: Date.now() + 45 * 60_000 })),
    });

    await user.click(within(await cardOf("A4")).getByRole("button", { name: "Ligar" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Outro tempo" }));
    const minutes = within(dialog).getByLabelText("Minutos");
    await user.clear(minutes);
    await user.type(minutes, "20");
    expect(within(dialog).getByRole("button", { name: "Ligar" })).toBeDisabled();

    await user.clear(minutes);
    await user.type(minutes, "45");
    await user.click(within(dialog).getByRole("button", { name: "Ligar" }));

    await screen.findByText("Torre A · final 4: ligando.");
    expect(requests.find((request) => request.path === "/exhausts/A4/on")?.body).toEqual({ minutes: 45 });
  });

  it("desliga só depois de confirmar", async () => {
    const user = userEvent.setup();
    const requests = openPage([exhaust({ on: true, expiresAt: Date.now() + 60_000 * 60 })], "porteiro", {
      "POST /exhausts/A4/off": () => okResponse(exhaust({ on: false, processStatus: "iniciando", command: "desligar" })),
    });

    await user.click(within(await cardOf("A4")).getByRole("button", { name: "Desligar" }));
    expect(requests.some((request) => request.path === "/exhausts/A4/off")).toBe(false);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Desligar" }));

    expect(await screen.findByText("Torre A · final 4: desligando.")).toBeInTheDocument();
    expect(within(await cardOf("A4")).getByText("Desligando…")).toBeInTheDocument();
  });

  it("mostra a recusa do servidor sem repetir o comando", async () => {
    const user = userEvent.setup();
    const requests = openPage([exhaust({})], "porteiro", {
      "POST /exhausts/A4/on": () => errorResponse("upstream-error", 503, "Módulo A_14 está offline."),
    });

    await user.click(within(await cardOf("A4")).getByRole("button", { name: "Ligar" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Ligar" }));

    expect(await screen.findByText("Módulo A_14 está offline.")).toBeInTheDocument();
    expect(requests.filter((request) => request.path === "/exhausts/A4/on")).toHaveLength(1);
  });

  it("atualiza pelo tempo real", async () => {
    openPage([exhaust({})]);
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    act(() => lastSocket().serverOpen());
    expect(within(await cardOf("A4")).getByText("Desligado")).toBeInTheDocument();

    act(() =>
      lastSocket().serverSend({
        event: "exhaust.changed",
        data: exhaust({ on: true, processStatus: "executado", expiresAt: Date.now() + 10 * 60_000 }),
      }),
    );

    expect(await within(await cardOf("A4")).findByText("Ligado")).toBeInTheDocument();
  });

  it("filtra só os ligados", async () => {
    const user = userEvent.setup();
    openPage([exhaust({ id: "A4", on: true, expiresAt: null }), exhaust({ id: "A2", final: 2 })]);

    await cardOf("A2");
    await user.click(screen.getByLabelText("Só ligados (1)"));

    await waitFor(() => expect(screen.queryByRole("heading", { name: "A2" })).not.toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "A4" })).toBeInTheDocument();
  });

  it("manutenção só para síndico/admin, com confirmação", async () => {
    const user = userEvent.setup();
    const requests = openPage([exhaust({})], "sindico", {
      "PUT /exhausts/A4/maintenance": () => okResponse(exhaust({ maintenance: true })),
    });

    await user.click(await screen.findByRole("button", { name: "Mais ações de A4" }));
    await user.click(await screen.findByRole("menuitem", { name: "Marcar manutenção" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Marcar manutenção" }));

    expect(await screen.findByText("Torre A · final 4: em manutenção.")).toBeInTheDocument();
    expect(requests.find((request) => request.method === "PUT")?.body).toEqual({ maintenance: true });
  });

  it("porteiro não vê a manutenção", async () => {
    openPage([exhaust({})]);

    await cardOf("A4");
    expect(screen.queryByRole("button", { name: "Mais ações de A4" })).not.toBeInTheDocument();
  });
});
