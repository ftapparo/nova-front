import { api } from "@/core/api/api";
import { getSession, refreshSession } from "@/core/session/sessionStore";

// =============================================================================
// Conexão de tempo real com a nova-api v3 (/v3/ws). Uma por aba.
//
// O servidor só envia: { event, timestamp, data, meta }. Eventos são deltas,
// não retratos — o estado vem da REST e os eventos são aplicados por cima. Por
// isso, a cada (re)conexão, quem iniciou recarrega as consultas (onOpen).
//
// O navegador não expõe o status HTTP de um upgrade recusado (401 ticket
// usado, 429 mais de 3 sockets da conta, 503 servidor cheio): tudo chega como
// um fechamento comum. Toda falha vira nova tentativa com espera crescente, e
// as telas usam polling enquanto o estado não for "open".
// =============================================================================

export type RealtimeState = "idle" | "connecting" | "open" | "reconnecting";

/** Serviço por trás da API que perdeu a conexão (central de incêndio, portão). */
export interface UpstreamOutage {
  service: string;
  numeroDispositivo: number | null;
}

export interface RealtimeStatus {
  state: RealtimeState;
  outages: UpstreamOutage[];
}

type EventHandler = (data: unknown) => void;

const BACKOFF_START_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
// Fechamento do servidor quando expira o access token que pediu o ticket.
const TOKEN_EXPIRED_CLOSE_CODE = 4001;
// Aba em segundo plano solta o socket depois deste tempo: cada conta tem no
// máximo 3, e abas esquecidas abertas não devem ocupar a vaga da que está em uso.
const HIDDEN_GRACE_MS = 60_000;

const socketUrl = (ticket: string) => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/v3/ws?ticket=${encodeURIComponent(ticket)}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

class RealtimeConnection {
  private running = false;
  private paused = false;
  private socket: WebSocket | null = null;
  /** Muda a cada conexão e a cada parada: callbacks de uma conexão antiga são ignorados. */
  private generation = 0;
  private failures = 0;
  private retryTimer: number | undefined;
  private hiddenTimer: number | undefined;
  /** Access token que pediu o ticket atual: é ele que o 4001 dá como vencido. */
  private ticketToken: string | undefined;
  private onOpen: (() => void) | null = null;

  private status: RealtimeStatus = { state: "idle", outages: [] };
  private readonly outages = new Map<string, UpstreamOutage>();
  private readonly statusListeners = new Set<() => void>();
  private readonly handlers = new Map<string, Set<EventHandler>>();

  /** Liga o tempo real. `onOpen` roda a cada conexão aberta (para recarregar o estado). */
  start(onOpen: () => void) {
    this.stop();
    this.running = true;
    this.onOpen = onOpen;
    document.addEventListener("visibilitychange", this.handleVisibility);
    void this.connect();
  }

  stop() {
    if (!this.running && this.status.state === "idle") return;
    this.running = false;
    this.paused = false;
    this.failures = 0;
    this.onOpen = null;
    document.removeEventListener("visibilitychange", this.handleVisibility);
    window.clearTimeout(this.hiddenTimer);
    this.disconnect();
    this.outages.clear();
    this.publish("idle");
  }

  getStatus = (): RealtimeStatus => this.status;

  subscribeStatus = (listener: () => void): (() => void) => {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  };

  /** Recebe o `data` de um evento. Devolve a função que cancela a inscrição. */
  subscribe(event: string, handler: EventHandler): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  private publish(state: RealtimeState) {
    this.status = { state, outages: [...this.outages.values()] };
    for (const listener of this.statusListeners) listener();
  }

  private disconnect() {
    this.generation += 1;
    window.clearTimeout(this.retryTimer);
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState !== WebSocket.CLOSED) socket.close(1000);
  }

  private async connect(refreshFirst = false) {
    const generation = ++this.generation;
    this.publish(this.failures === 0 && !refreshFirst ? "connecting" : "reconnecting");

    try {
      if (refreshFirst) {
        // Sessão encerrada: o logout desmonta o painel e para a conexão.
        if (!(await refreshSession(this.ticketToken))) return;
      }
      const { ticket } = await api.post<{ ticket: string }>("/ws/ticket");
      if (generation !== this.generation) return;
      this.ticketToken = getSession()?.accessToken;
      this.open(generation, ticket);
    } catch {
      if (generation !== this.generation || !getSession()) return;
      // Ticket recusado ou API fora do ar: mesma espera de um socket que caiu.
      this.scheduleRetry();
    }
  }

  private open(generation: number, ticket: string) {
    const socket = new WebSocket(socketUrl(ticket));
    this.socket = socket;
    const current = () => generation === this.generation;

    socket.onopen = () => {
      if (!current()) return;
      this.failures = 0;
      // Quedas de serviço são avisadas só quando mudam: as anteriores à
      // reconexão já não valem, e as telas leem o estado atual pela REST.
      this.outages.clear();
      this.publish("open");
      this.onOpen?.();
    };
    socket.onmessage = (message) => {
      if (current()) this.dispatch(message.data);
    };
    socket.onclose = (event) => {
      if (!current()) return;
      this.socket = null;
      if (event.code === TOKEN_EXPIRED_CLOSE_CODE) void this.connect(true);
      else this.scheduleRetry();
    };
  }

  private scheduleRetry() {
    if (!this.running || this.paused) return;
    const delay = Math.min(BACKOFF_START_MS * 2 ** this.failures, BACKOFF_MAX_MS);
    this.failures += 1;
    this.publish("reconnecting");
    this.retryTimer = window.setTimeout(() => void this.connect(), delay);
  }

  private dispatch(raw: unknown) {
    let message: unknown;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }
    // Evento desconhecido ou fora do formato é ignorado: o servidor pode
    // ganhar eventos novos antes de o painel saber tratá-los.
    if (!isRecord(message) || typeof message.event !== "string") return;

    if (message.event === "upstream.connection.changed") this.updateOutage(message.data);

    for (const handler of this.handlers.get(message.event) ?? []) {
      try {
        handler(message.data);
      } catch (error) {
        // Um handler com defeito não pode impedir os outros de receberem o evento.
        console.error(`[realtime] Falha ao tratar ${message.event}:`, error);
      }
    }
  }

  private updateOutage(data: unknown) {
    if (!isRecord(data) || typeof data.service !== "string") return;
    const numeroDispositivo = typeof data.numeroDispositivo === "number" ? data.numeroDispositivo : null;
    const key = `${data.service}:${numeroDispositivo ?? ""}`;
    if (data.connected === false) this.outages.set(key, { service: data.service, numeroDispositivo });
    else this.outages.delete(key);
    this.publish(this.status.state);
  }

  private handleVisibility = () => {
    window.clearTimeout(this.hiddenTimer);
    if (document.visibilityState === "hidden") {
      this.hiddenTimer = window.setTimeout(() => {
        this.paused = true;
        this.disconnect();
        this.publish("idle");
      }, HIDDEN_GRACE_MS);
      return;
    }
    if (this.paused) {
      this.paused = false;
      this.failures = 0;
      void this.connect();
    }
  };
}

/** Conexão única da aba. Quem liga e desliga é o layout do painel (useRealtimeConnection). */
export const realtime = new RealtimeConnection();
