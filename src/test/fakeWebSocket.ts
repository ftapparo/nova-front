import { vi } from "vitest";

/**
 * WebSocket simulado: o teste decide quando abrir, o que chega e como fecha.
 * Os testes nunca abrem conexão real com a API.
 */
export class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState = FakeWebSocket.CONNECTING;
  closeCode: number | null = null;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  /** Fechamento pedido pelo painel. */
  close(code = 1000) {
    this.closeCode = code;
    this.readyState = FakeWebSocket.CLOSED;
  }

  serverOpen() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  serverSend(message: unknown) {
    const data = typeof message === "string" ? message : JSON.stringify(message);
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  /** Queda ou fechamento pelo servidor; 1006 = conexão perdida/recusada. */
  serverClose(code = 1006) {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code }));
  }
}

export function installFakeWebSocket() {
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
}

export const lastSocket = (): FakeWebSocket => {
  const socket = FakeWebSocket.instances.at(-1);
  if (!socket) throw new Error("nenhum WebSocket foi aberto");
  return socket;
};
