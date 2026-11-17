import { beforeAll, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { installFakeWebSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";

type Routes = Parameters<typeof fakeApi>[0];

const openPage = (routes: Routes = {}, role: "sindico" | "admin" = "sindico"): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ role });
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

  describe("teste do alarme de incêndio (admin)", () => {
    const device = (overrides: Record<string, unknown>) => ({
      accountId: "9152eea2-c5e7-4fec-a296-85f20c68f51f",
      email: "morador@gmail.com",
      platform: "android",
      installationId: "0b6f3b9e-8a5e-4a43-9d0c-3f1a2b4c5d6e",
      appVersion: "1.0.0",
      osVersion: "14",
      deviceModel: "samsung SM-J410G",
      language: "pt-BR",
      role: null,
      notificationsEnabled: true,
      alarmChannelEnabled: true,
      tokenValid: true,
      createdAt: "2026-11-01T10:00:00.000Z",
      lastSeenAt: "2026-11-17T02:50:08.706Z",
      ...overrides,
    });
    const devices = [
      device({}),
      device({ installationId: "1c7e4caf-9b6f-4b54-8e1d-4a2b3c5d6e7f", email: "outro@gmail.com", deviceModel: "moto g", notificationsEnabled: false }),
    ];

    it("não aparece para o síndico", async () => {
      const requests = openPage();

      expect(await screen.findByText("Aviso para a equipe")).toBeInTheDocument();
      expect(screen.queryByText("Teste do alarme de incêndio")).not.toBeInTheDocument();
      expect(requests.some((request) => request.path === "/notifications/devices")).toBe(false);
    });

    it("envia ao aparelho escolhido só depois de confirmar", async () => {
      const user = userEvent.setup();
      const requests = openPage(
        {
          "GET /notifications/devices": () => okResponse(devices),
          "POST /notifications/test/fire-alarm": () => okResponse({ targets: 1, sent: 1, failed: 0 }),
        },
        "admin",
      );

      await user.click(await screen.findByRole("combobox", { name: "Aparelho" }));
      const blocked = await screen.findByRole("option", { name: /outro@gmail.com/ });
      expect(blocked).toHaveAttribute("aria-disabled", "true");
      expect(within(blocked).getByText("notificações desligadas no aparelho")).toBeInTheDocument();
      await user.click(screen.getByRole("option", { name: /morador@gmail.com/ }));
      await user.click(screen.getByRole("button", { name: "Normalizado" }));
      await user.click(screen.getByRole("button", { name: "Testar alarme" }));
      expect(requests.some((request) => request.path === "/notifications/test/fire-alarm")).toBe(false);
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Enviar teste" }));

      expect(await screen.findByText('Teste "Normalizado" enviado ao aparelho.')).toBeInTheDocument();
      expect(requests.find((request) => request.path === "/notifications/test/fire-alarm")?.body).toEqual({
        installationId: "0b6f3b9e-8a5e-4a43-9d0c-3f1a2b4c5d6e",
        type: "resolved",
      });
    });

    it("mostra o limite de testes", async () => {
      const user = userEvent.setup();
      openPage(
        {
          "GET /notifications/devices": () => okResponse(devices),
          "POST /notifications/test/fire-alarm": () =>
            errorResponse("rate-limited", 429, "Muitas tentativas. Tente novamente em instantes."),
        },
        "admin",
      );

      await user.click(await screen.findByRole("combobox", { name: "Aparelho" }));
      await user.click(await screen.findByRole("option", { name: /morador@gmail.com/ }));
      await user.click(screen.getByRole("button", { name: "Testar alarme" }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Enviar teste" }));

      expect(await screen.findByText("Muitas tentativas. Tente novamente em instantes.")).toBeInTheDocument();
    });
  });
});
