import { beforeAll, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { installFakeWebSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";

type Routes = Parameters<typeof fakeApi>[0];

const openPage = (routes: Routes = {}): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ role: "sindico" });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => errorResponse("upstream-error", 503, null),
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp("/notificacoes");
  return requests;
};

describe("Notificações", () => {
  beforeAll(async () => {
    await import("./NotificationsPage");
  });

  it("avisa quando o navegador não recebe notificações", async () => {
    openPage();

    expect(await screen.findByText("Indisponíveis")).toBeInTheDocument();
  });

  it("envia aviso para a equipe só depois de confirmar", async () => {
    const user = userEvent.setup();
    const requests = openPage({
      "POST /push/send": () => okResponse({ sentAt: 1, dispatch: { totalSubscriptions: 3, sent: 3, failed: 0, removedInvalid: 0 } }),
    });

    await user.type(await screen.findByLabelText("Título"), "Troca de turno");
    await user.type(screen.getByLabelText("Texto"), "Reunião às 18h na portaria.");
    await user.click(screen.getByRole("button", { name: "Enviar aviso" }));
    expect(requests.some((request) => request.path === "/push/send")).toBe(false);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Enviar" }));

    expect(await screen.findByText("Aviso enviado a 3 de 3 navegador(es).")).toBeInTheDocument();
    expect(requests.find((request) => request.path === "/push/send")?.body).toEqual({
      title: "Troca de turno",
      body: "Reunião às 18h na portaria.",
      tag: "aviso-equipe",
      data: { url: "/" },
    });
  });

  it("mostra o resultado do teste no aplicativo", async () => {
    const user = userEvent.setup();
    openPage({ "POST /notifications/test": () => okResponse({ targets: 0, sent: 0, failed: 0 }) });

    await user.click(await screen.findByRole("button", { name: "Enviar teste" }));

    expect(await screen.findByText("Nenhum aparelho com o aplicativo registrado nesta conta.")).toBeInTheDocument();
  });

  it("mostra quando o envio está desativado no servidor", async () => {
    const user = userEvent.setup();
    openPage({
      "POST /notifications/test": () => errorResponse("upstream-error", 503, "O envio de notificações está desativado no servidor."),
    });

    await user.click(await screen.findByRole("button", { name: "Enviar teste" }));

    expect(await screen.findByText("O envio de notificações está desativado no servidor.")).toBeInTheDocument();
  });
});
