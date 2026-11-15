import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useRealtimeConnection } from "@/core/realtime/useRealtime";
import { startSession } from "@/core/session/sessionStore";
import { fakeApi, okResponse, sessionData, sessionUser } from "@/test/fakeApi";
import { FakeWebSocket, installFakeWebSocket, lastSocket } from "@/test/fakeWebSocket";
import { renderApp } from "@/test/renderApp";

const openPanel = () => {
  installFakeWebSocket();
  const user = sessionUser({ role: "admin" });
  fakeApi({
    "GET /auth/me": () => okResponse(user),
    "POST /ws/ticket": () => okResponse({ ticket: "t-1", expiresIn: 30 }),
    "POST /auth/logout": () => okResponse(null),
  });
  startSession(sessionData({ user }));
  renderApp("/");
};

describe("tempo real no painel", () => {
  it("conecta ao abrir o painel e mostra a situação na barra", async () => {
    openPanel();

    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    expect(await screen.findByText("Conectando…")).toBeInTheDocument();

    act(() => lastSocket().serverOpen());
    expect(await screen.findByText("Tempo real")).toBeInTheDocument();

    act(() =>
      lastSocket().serverSend({ event: "upstream.connection.changed", data: { service: "cie", connected: false } }),
    );
    expect(await screen.findByText("Dados podem estar desatualizados")).toBeInTheDocument();

    act(() => lastSocket().serverClose(1006));
    expect(await screen.findByText("Reconectando…")).toBeInTheDocument();
  });

  it("fecha a conexão ao sair", async () => {
    const user = userEvent.setup();
    openPanel();
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = lastSocket();
    act(() => socket.serverOpen());

    await user.click(await screen.findByRole("button", { name: "Conta" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sair" }));

    await waitFor(() => expect(socket.closeCode).toBe(1000));
  });

  it("recarrega as consultas da tela a cada conexão aberta", async () => {
    installFakeWebSocket();
    let loads = 0;
    fakeApi({ "POST /ws/ticket": () => okResponse({ ticket: "t-1", expiresIn: 30 }) });
    startSession(sessionData());

    function Screen() {
      useRealtimeConnection();
      useQuery({ queryKey: ["portoes"], queryFn: () => ++loads });
      return null;
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Screen />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    await waitFor(() => expect(loads).toBe(1));

    act(() => lastSocket().serverOpen());

    // Eventos chegados com o socket fora se perderam: o estado vem de novo da REST.
    await waitFor(() => expect(loads).toBe(2));
  });
});
