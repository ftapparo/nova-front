import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSession, startSession } from "@/core/session/sessionStore";
import { errorResponse, fakeApi, okResponse, sessionData, type FakeRequest } from "@/test/fakeApi";
import { FakeWebSocket, installFakeWebSocket, lastSocket } from "@/test/fakeWebSocket";
import { realtime } from "./realtime";

let ticketCount = 0;
const ticketRoute = () => {
  ticketCount += 1;
  return okResponse({ ticket: `t-${ticketCount}`, expiresIn: 30 });
};

const ticketRequests = (requests: FakeRequest[]) => requests.filter((request) => request.path === "/ws/ticket");

const setVisibility = (value: DocumentVisibilityState) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => value });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("realtime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ticketCount = 0;
    installFakeWebSocket();
    startSession(sessionData());
  });

  afterEach(() => {
    realtime.stop();
    setVisibility("visible");
    vi.useRealTimers();
  });

  it("pede um ticket e conecta na própria origem", async () => {
    const requests = fakeApi({ "POST /ws/ticket": ticketRoute });
    const onOpen = vi.fn();

    realtime.start(onOpen);
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));

    expect(ticketRequests(requests)[0]?.headers.get("Authorization")).toBe("Bearer access-1");
    expect(lastSocket().url).toBe(`ws://${window.location.host}/v3/ws?ticket=t-1`);
    expect(realtime.getStatus().state).toBe("connecting");

    lastSocket().serverOpen();

    expect(realtime.getStatus().state).toBe("open");
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("entrega os eventos a quem se inscreveu e ignora o que não entende", async () => {
    fakeApi({ "POST /ws/ticket": ticketRoute });
    const handler = vi.fn();
    const unsubscribe = realtime.subscribe("exhaust.changed", handler);
    realtime.start(() => {});
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    lastSocket().serverOpen();

    lastSocket().serverSend({ event: "exhaust.changed", timestamp: "", data: { id: "A4", on: true } });
    lastSocket().serverSend({ event: "evento.novo", data: {} });
    lastSocket().serverSend("isto não é json");
    lastSocket().serverSend({ semEvento: true });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ id: "A4", on: true });

    unsubscribe();
    lastSocket().serverSend({ event: "exhaust.changed", data: { id: "A4", on: false } });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("um handler com defeito não impede os demais", async () => {
    fakeApi({ "POST /ws/ticket": ticketRoute });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const healthy = vi.fn();
    realtime.subscribe("command.logged", () => {
      throw new Error("defeito");
    });
    realtime.subscribe("command.logged", healthy);
    realtime.start(() => {});
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    lastSocket().serverOpen();

    lastSocket().serverSend({ event: "command.logged", data: {} });

    expect(healthy).toHaveBeenCalledTimes(1);
    expect(errorLog).toHaveBeenCalled();
  });

  it("reconecta com espera crescente depois de quedas", async () => {
    const requests = fakeApi({ "POST /ws/ticket": ticketRoute });
    realtime.start(() => {});
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));

    lastSocket().serverClose(1006);
    expect(realtime.getStatus().state).toBe("reconnecting");

    await vi.advanceTimersByTimeAsync(999);
    expect(ticketRequests(requests)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    expect(lastSocket().url).toContain("ticket=t-2");

    // Segunda queda seguida: espera o dobro.
    lastSocket().serverClose(1006);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(ticketRequests(requests)).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(3));

    // Conectou: a próxima queda volta a esperar só 1 s.
    lastSocket().serverOpen();
    lastSocket().serverClose(1006);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(4));
  });

  it("limita a espera a 30 s", async () => {
    const requests = fakeApi({ "POST /ws/ticket": () => errorResponse("upstream-error", 503, "Indisponível.") });
    const timers = vi.spyOn(window, "setTimeout");
    realtime.start(() => {});

    for (let attempt = 1; attempt <= 7; attempt += 1) {
      await vi.waitFor(() => expect(ticketRequests(requests)).toHaveLength(attempt));
      // A espera só é agendada quando a recusa do ticket termina de ser processada.
      await vi.waitFor(() => expect(timers.mock.calls.filter(([, delay]) => (delay ?? 0) >= 1_000)).toHaveLength(attempt));
      await vi.runOnlyPendingTimersAsync();
    }

    // Cada tentativa espera o dobro da anterior, até o teto de 30 s.
    const delays = timers.mock.calls.map(([, delay]) => delay ?? 0).filter((delay) => delay >= 1_000);
    expect(delays.slice(0, 7)).toEqual([1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]);
  });

  it("no fechamento 4001 renova a sessão e reconecta na hora com um ticket novo", async () => {
    const requests = fakeApi({
      "POST /ws/ticket": ticketRoute,
      "POST /auth/refresh": () => okResponse(sessionData({ accessToken: "access-2", refreshToken: "refresh-2" })),
    });
    realtime.start(() => {});
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    lastSocket().serverOpen();

    lastSocket().serverClose(4001);
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));

    expect(requests.map((request) => request.path)).toEqual(["/ws/ticket", "/auth/refresh", "/ws/ticket"]);
    expect(ticketRequests(requests)[1]?.headers.get("Authorization")).toBe("Bearer access-2");
    expect(getSession()?.refreshToken).toBe("refresh-2");
  });

  it("para sem reconectar e fecha o socket", async () => {
    const requests = fakeApi({ "POST /ws/ticket": ticketRoute });
    realtime.start(() => {});
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const socket = lastSocket();
    socket.serverOpen();

    realtime.stop();
    socket.serverClose(1000);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(socket.closeCode).toBe(1000);
    expect(realtime.getStatus().state).toBe("idle");
    expect(ticketRequests(requests)).toHaveLength(1);
  });

  it("acompanha a queda e a volta dos serviços por trás da API", async () => {
    fakeApi({ "POST /ws/ticket": ticketRoute });
    realtime.start(() => {});
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    lastSocket().serverOpen();

    lastSocket().serverSend({ event: "upstream.connection.changed", data: { service: "cie", connected: false } });
    lastSocket().serverSend({
      event: "upstream.connection.changed",
      data: { service: "tag", numeroDispositivo: 2, connected: false },
    });
    expect(realtime.getStatus().outages).toEqual([
      { service: "cie", numeroDispositivo: null },
      { service: "tag", numeroDispositivo: 2 },
    ]);

    lastSocket().serverSend({ event: "upstream.connection.changed", data: { service: "cie", connected: true } });
    expect(realtime.getStatus().outages).toEqual([{ service: "tag", numeroDispositivo: 2 }]);

    // Depois de reconectar, o aviso antigo não vale mais.
    lastSocket().serverClose(1006);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    lastSocket().serverOpen();
    expect(realtime.getStatus().outages).toEqual([]);
  });

  it("solta o socket com a aba em segundo plano e reconecta ao voltar", async () => {
    fakeApi({ "POST /ws/ticket": ticketRoute });
    const onOpen = vi.fn();
    realtime.start(onOpen);
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    const first = lastSocket();
    first.serverOpen();

    setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(59_000);
    expect(first.closeCode).toBeNull();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(first.closeCode).toBe(1000);
    expect(realtime.getStatus().state).toBe("idle");

    setVisibility("visible");
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    lastSocket().serverOpen();

    // Reabriu: as telas recarregam o que mudou enquanto estava fora.
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("uma nova conexão na mesma aba não herda a espera das quedas anteriores", async () => {
    const requests = fakeApi({ "POST /ws/ticket": ticketRoute });
    realtime.start(() => {});
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    lastSocket().serverClose(1006);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2));
    lastSocket().serverClose(1006);

    // Logout e novo login na mesma aba.
    realtime.stop();
    realtime.start(() => {});
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(3));
    lastSocket().serverClose(1006);

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(ticketRequests(requests)).toHaveLength(4));
  });

  it("aba que volta antes do prazo mantém a conexão", async () => {
    fakeApi({ "POST /ws/ticket": ticketRoute });
    realtime.start(() => {});
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1));
    lastSocket().serverOpen();

    setVisibility("hidden");
    await vi.advanceTimersByTimeAsync(30_000);
    setVisibility("visible");
    await vi.advanceTimersByTimeAsync(60_000);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(lastSocket().closeCode).toBeNull();
  });
});
