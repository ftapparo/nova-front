import { beforeAll, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { installFakeWebSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";
import { carouselLabel, type CondoMessage } from "./messagesApi";

const message = (overrides: Partial<CondoMessage> = {}): CondoMessage => ({
  id: 12,
  category: "manutencao",
  label: "Manutenção programada",
  title: "Bomba de recalque",
  body: "A equipe técnica fará a manutenção hoje à tarde.",
  publishedAt: "2026-11-15T13:30:00.000Z",
  expiresAt: null,
  carouselTtlHours: 24,
  pinned: false,
  read: false,
  ...overrides,
});

type Routes = Parameters<typeof fakeApi>[0];

const openPage = (role: "porteiro" | "sindico", routes: Routes = {}): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ role });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => errorResponse("upstream-error", 503, null),
    "GET /messages": () => okResponse({ items: [message(), message({ id: 13, category: "urgente", label: null, title: "Falta de água", pinned: true, carouselTtlHours: 0 })], unreadCount: 2 }),
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp("/comunicados");
  return requests;
};

describe("carouselLabel", () => {
  it("descreve o tempo no carrossel", () => {
    expect(carouselLabel({ pinned: true, carouselTtlHours: 0 })).toBe("Fixado no carrossel");
    expect(carouselLabel({ pinned: false, carouselTtlHours: 0 })).toBe("No carrossel até cada morador ler");
    expect(carouselLabel({ pinned: false, carouselTtlHours: 48 })).toBe("No carrossel por 48 h");
  });
});

describe("Comunicados", () => {
  beforeAll(async () => {
    await import("./MessagesPage");
  });

  it("lista os comunicados com categoria, etiqueta e situação no carrossel", async () => {
    openPage("porteiro");

    const water = await screen.findByRole("article", { name: "Falta de água" });
    expect(within(water).getByText("Urgente")).toBeInTheDocument();
    expect(within(water).getByText("Fixado")).toBeInTheDocument();
    const pump = screen.getByRole("article", { name: "Bomba de recalque" });
    expect(within(pump).getByText("Manutenção programada")).toBeInTheDocument();
    expect(within(pump).getByText(/No carrossel por 24 h/)).toBeInTheDocument();
  });

  it("porteiro só lê: não publica nem gerencia", async () => {
    openPage("porteiro");

    await screen.findByRole("article", { name: "Bomba de recalque" });
    expect(screen.queryByRole("button", { name: "Novo comunicado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ações do comunicado/ })).not.toBeInTheDocument();
  });

  it("síndico publica com as opções padrão", async () => {
    const user = userEvent.setup();
    const requests = openPage("sindico", { "POST /messages": () => okResponse(message({ id: 20 }), 201) });

    await user.click(await screen.findByRole("button", { name: "Novo comunicado" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Título"), "Assembleia");
    await user.type(within(dialog).getByLabelText("Texto"), "Dia 20, às 19h, no salão.");
    await user.click(within(dialog).getByRole("button", { name: "Publicar" }));

    expect(await screen.findByText("Comunicado publicado.")).toBeInTheDocument();
    expect(requests.find((request) => request.method === "POST" && request.path === "/messages")?.body).toEqual({
      category: "comunicado",
      title: "Assembleia",
      body: "Dia 20, às 19h, no salão.",
      pinned: false,
      carouselTtlHours: 24,
      notify: true,
    });
  });

  it("não envia sem título e texto", async () => {
    const user = userEvent.setup();
    const requests = openPage("sindico");

    await user.click(await screen.findByRole("button", { name: "Novo comunicado" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Publicar" }));

    expect(await screen.findByText("Informe o título.")).toBeInTheDocument();
    expect(screen.getByText("Escreva o comunicado.")).toBeInTheDocument();
    expect(requests.some((request) => request.method === "POST" && request.path === "/messages")).toBe(false);
  });

  it("fixa no carrossel pelo menu do comunicado", async () => {
    const user = userEvent.setup();
    const requests = openPage("sindico", { "PATCH /messages/12": () => okResponse(message({ pinned: true, carouselTtlHours: 0 })) });

    await user.click(await screen.findByRole("button", { name: "Ações do comunicado Bomba de recalque" }));
    await user.click(await screen.findByRole("menuitem", { name: "Fixar no carrossel" }));

    expect(await screen.findByText("Fixado no carrossel.")).toBeInTheDocument();
    expect(requests.find((request) => request.method === "PATCH")?.body).toEqual({ pinned: true });
  });

  it("muda o tempo no carrossel", async () => {
    const user = userEvent.setup();
    const requests = openPage("sindico", { "PATCH /messages/12": () => okResponse(message({ carouselTtlHours: 72 })) });

    await user.click(await screen.findByRole("button", { name: "Ações do comunicado Bomba de recalque" }));
    await user.click(await screen.findByRole("menuitem", { name: "Tempo no carrossel" }));
    const dialog = await screen.findByRole("dialog");
    const hours = within(dialog).getByLabelText("Horas");
    await user.clear(hours);
    await user.type(hours, "72");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Tempo no carrossel alterado.")).toBeInTheDocument();
    expect(requests.find((request) => request.method === "PATCH")?.body).toEqual({ carouselTtlHours: 72 });
  });

  it("arquiva só depois de confirmar", async () => {
    const user = userEvent.setup();
    const requests = openPage("sindico", { "DELETE /messages/12": () => okResponse(null) });

    await user.click(await screen.findByRole("button", { name: "Ações do comunicado Bomba de recalque" }));
    await user.click(await screen.findByRole("menuitem", { name: "Arquivar" }));
    expect(requests.some((request) => request.method === "DELETE")).toBe(false);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Arquivar" }));

    expect(await screen.findByText("Comunicado arquivado.")).toBeInTheDocument();
  });
});
