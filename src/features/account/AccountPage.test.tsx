import { beforeAll, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, sessionUser, type FakeRequest } from "@/test/fakeApi";
import { installFakeWebSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";

type Routes = Parameters<typeof fakeApi>[0];

const preferences = { exhaustExpiring: true, exhaustExpiringMinutes: 15, exhaustOff: true, messages: true, cieStaffAlerts: false };

const openPage = (routes: Routes = {}): FakeRequest[] => {
  installFakeWebSocket();
  const user = sessionUser({ role: "porteiro", email: "portaria@novaresidence.com.br" });
  const requests = fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => errorResponse("upstream-error", 503, null),
    "GET /notifications/preferences": () => okResponse(preferences),
    ...routes,
  });
  startSession(sessionData({ user }));
  renderApp("/conta");
  return requests;
};

describe("Minha conta", () => {
  beforeAll(async () => {
    await import("./AccountPage");
  });

  it("mostra a conta, o perfil e o caminho para trocar a senha", async () => {
    openPage();

    expect(await screen.findByText("portaria@novaresidence.com.br", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Perfil: Portaria")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Trocar senha" })).toHaveAttribute("href", "/trocar-senha");
  });

  it("mostra as preferências do aplicativo com o tempo do servidor e grava a alteração", async () => {
    const user = userEvent.setup();
    const requests = openPage({
      "PUT /notifications/preferences": () => okResponse({ ...preferences, cieStaffAlerts: true }),
    });

    expect(await screen.findByLabelText("Exaustor que liguei: aviso 15 min antes de desligar")).toBeChecked();
    const cie = screen.getByLabelText(/Alertas da central além do alarme/);
    expect(cie).not.toBeChecked();
    await user.click(cie);

    await screen.findByText("Notificações no aplicativo");
    expect(requests.find((request) => request.method === "PUT")?.body).toEqual({ cieStaffAlerts: true });
    expect(await screen.findByLabelText(/Alertas da central além do alarme/)).toBeChecked();
  });

  it("troca o tema deste navegador", async () => {
    const user = userEvent.setup();
    openPage();

    await user.click(await screen.findByRole("button", { name: "Escuro" }));

    expect(screen.getByRole("button", { name: "Escuro" })).toHaveAttribute("aria-pressed", "true");
  });
});
