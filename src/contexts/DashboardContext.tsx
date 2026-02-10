import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { api, type DoorItem, type ExhaustProcessMemoryItem, type ExhaustStatusResponse, type GateItem, type AccessListItem } from "@/services/api";
import { notify } from "@/lib/notify";

export interface ExhaustDeviceItem {
  id: string;
  nome: string;
  host: string | null;
  port: number | null;
  statusCode: number | null;
  online: boolean;
  error: string | null;
}

export interface ExhaustRunningStatus {
  id: string;
  isRunning: boolean;
  remainingMinutes: number | null;
  generatedAt: string;
  activeCount: number;
  memory: ExhaustProcessMemoryItem | null;
}

export interface LatestGateAccessItem {
  gateId: number;
  gateName: string;
  tag: string;
  nome: string;
  descricao: string;
  quadra: string;
  lote: string;
  validatedAt: string;
  sentido: string;
}

interface DashboardContextType {
  doors: DoorItem[];
  gates: GateItem[];
  exhaustDevices: ExhaustDeviceItem[];
  latestGateAccesses: LatestGateAccessItem[];
  latestAccessAutoRefresh: boolean;
  setLatestAccessAutoRefresh: (enabled: boolean) => void;
  lastAction: string | null;
  apiError: string | null;
  refreshing: boolean;
  loadDevices: (options?: { silent?: boolean }) => Promise<void>;
  handleOpenDoor: (id: string) => Promise<void>;
  handleOpenGate: (id: string, autoClose: number) => Promise<void>;
  handleExhaustOn: (block: string, apartment: string, duration: number) => Promise<void>;
  handleExhaustOff: (block: string, apartment: string) => Promise<void>;
  handleExhaustStatus: (id: string) => Promise<ExhaustRunningStatus>;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return context;
}

interface Props {
  children: ReactNode;
}

export function DashboardProvider({ children }: Props) {
  const [doors, setDoors] = useState<DoorItem[]>([]);
  const [gates, setGates] = useState<GateItem[]>([]);
  const [exhaustDevices, setExhaustDevices] = useState<ExhaustDeviceItem[]>([]);
  const [latestGateAccesses, setLatestGateAccesses] = useState<LatestGateAccessItem[]>([]);
  const [latestAccessAutoRefresh, setLatestAccessAutoRefresh] = useState(true);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const getErrorMessage = (err: unknown) => (err instanceof Error ? err.message : "Erro desconhecido");

  const mapExhaustDevices = (statusResponse: ExhaustStatusResponse | null | undefined): ExhaustDeviceItem[] => {
    const modules = statusResponse?.modules ?? {};

    return Object.entries(modules)
      .map(([moduleId, module]) => {
        const statusCode = module.statusCode ?? null;
        const moduleError = module.error ?? null;
        const moduleName = module.status?.Status?.DeviceName || module.status?.Status?.FriendlyName?.[0] || moduleId;
        const online = statusCode === 200 && !moduleError;

        return {
          id: moduleId,
          nome: moduleName,
          host: module.host ?? null,
          port: module.port ?? null,
          statusCode,
          online,
          error: moduleError,
        } satisfies ExhaustDeviceItem;
      })
      .sort((a, b) => a.id.localeCompare(b.id, "pt-BR"));
  };

  const normalizeText = (value: unknown, fallback = "--"): string => {
    if (value === undefined || value === null) return fallback;
    const normalized = String(value).trim();
    return normalized || fallback;
  };

  const mapGateAccessItems = (gate: GateItem, items: AccessListItem[]): LatestGateAccessItem[] => {
    return items.map((item) => ({
      gateId: gate.numeroDispositivo,
      gateName: gate.nome,
      tag: normalizeText(item.IDACESSO),
      nome: normalizeText(item.NOME),
      descricao: normalizeText(item.DESCRICAO),
      quadra: normalizeText(item.TORRE),
      lote: normalizeText(item.APARTAMENTO),
      validatedAt: item.DATAHORA,
      sentido: normalizeText(item.SENTIDO, "E").toUpperCase(),
    }));
  };

  const loadLatestGateAccesses = useCallback(async (gatesToQuery?: GateItem[]): Promise<void> => {
    const targets = gatesToQuery ?? gates;

    if (!targets.length) {
      setLatestGateAccesses([]);
      return;
    }

    try {
      const accessResponses = await Promise.allSettled(
        targets.map((gate) => api.accessList(gate.numeroDispositivo, 10)),
      );
      const loadedLatestGateAccesses = accessResponses.flatMap((response, index) => {
        if (response.status !== "fulfilled") return [];
        const gate = targets[index];
        if (!gate) return [];
        return mapGateAccessItems(gate, response.value || []);
      })
        .sort((a, b) => new Date(b.validatedAt).getTime() - new Date(a.validatedAt).getTime())
        .slice(0, 20);

      setLatestGateAccesses(loadedLatestGateAccesses);
    } catch {
      // Ignora falhas pontuais do card de acessos para nao impactar o restante do painel.
    }
  }, [gates]);

  const loadDevices = useCallback(async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent);

    setRefreshing(true);
    setApiError(null);

    if (!silent) {
      notify.info("Atualizando dispositivos", { description: "Consultando portas e portoes." });
    }

    try {
      const [status, exhaustStatus] = await Promise.all([
        api.controlStatus(),
        api.exhaustStatusAll(),
      ]);
      const loadedDoors = status?.doors || [];
      const loadedGates = status?.gates || [];
      const loadedExhaustDevices = mapExhaustDevices(exhaustStatus);

      setDoors(loadedDoors);
      setGates(loadedGates);
      setExhaustDevices(loadedExhaustDevices);
      if (latestAccessAutoRefresh) {
        void loadLatestGateAccesses(loadedGates);
      }
      setLastAction("Dispositivos atualizados com sucesso.");

      if (!silent) {
        if ((loadedDoors.length === 0 && loadedGates.length === 0 && loadedExhaustDevices.length === 0) || status?.updatedAt === null) {
          notify.warning("Atualizacao concluida", {
            description: status?.error || "Aguardando dados serem atualizados.",
          });
        } else {
          notify.success("Dispositivos atualizados", {
            description: `${loadedDoors.length} porta(s), ${loadedGates.length} portao(oes) e ${loadedExhaustDevices.length} exaustor(es).`,
          });
        }
      }
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      setApiError(`Falha ao carregar dispositivos: ${errorMessage}`);
      notify.error("Falha ao atualizar dispositivos", { description: errorMessage });
    } finally {
      setRefreshing(false);
    }
  }, [latestAccessAutoRefresh, loadLatestGateAccesses]);

  useEffect(() => {
    loadDevices({ silent: true });
  }, [loadDevices]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadDevices({ silent: true });
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadDevices]);

  useEffect(() => {
    if (!gates.length) {
      setLatestGateAccesses([]);
      return;
    }

    if (!latestAccessAutoRefresh) {
      return;
    }

    void loadLatestGateAccesses(gates);
    const intervalId = window.setInterval(() => {
      void loadLatestGateAccesses(gates);
    }, 15_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [gates, latestAccessAutoRefresh, loadLatestGateAccesses]);

  const handleOpenDoor = useCallback(async (id: string) => {
    setApiError(null);
    notify.info("Enviando comando", { description: "Solicitando abertura da porta." });

    try {
      await api.openDoor(id);
      const name = doors.find((d) => String(d.id) === id)?.nome ?? id;
      setLastAction(`Porta "${name}" aberta com sucesso.`);
      notify.success("Porta aberta", { description: `Comando enviado para ${name}.` });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      setApiError(`Erro ao abrir porta: ${errorMessage}`);
      notify.error("Erro ao abrir porta", { description: errorMessage });
      throw err;
    }
  }, [doors]);

  const handleOpenGate = useCallback(async (id: string, autoClose: number) => {
    setApiError(null);
    notify.info("Enviando comando", { description: "Solicitando abertura do portao." });

    try {
      await api.openGate(id, autoClose);
      const name = gates.find((g) => String(g.numeroDispositivo) === id)?.nome ?? id;
      setLastAction(`Portao "${name}" aberto (fechamento em ${autoClose}s).`);
      notify.success("Portao aberto", { description: `${name} com fechamento em ${autoClose}s.` });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      setApiError(`Erro ao abrir portao: ${errorMessage}`);
      notify.error("Erro ao abrir portao", { description: errorMessage });
      throw err;
    }
  }, [gates]);

  const handleExhaustOn = useCallback(async (block: string, apartment: string, duration: number) => {
    setApiError(null);
    notify.info("Enviando comando", { description: `Ligando exaustor ${block}${apartment}.` });

    try {
      await api.exhaustOn(block, apartment, duration);
      setLastAction(`Exaustor ${block}${apartment} ligado por ${duration} min.`);
      notify.success("Exaustor ligado", { description: `${block}${apartment} por ${duration} minuto(s).` });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      setApiError(`Erro ao ligar exaustor: ${errorMessage}`);
      notify.error("Erro ao ligar exaustor", { description: errorMessage });
      throw err;
    }
  }, []);

  const handleExhaustOff = useCallback(async (block: string, apartment: string) => {
    setApiError(null);
    notify.info("Enviando comando", { description: `Desligando exaustor ${block}${apartment}.` });

    try {
      await api.exhaustOff(block, apartment);
      setLastAction(`Exaustor ${block}${apartment} desligado.`);
      notify.success("Exaustor desligado", { description: `${block}${apartment}.` });
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      setApiError(`Erro ao desligar exaustor: ${errorMessage}`);
      notify.error("Erro ao desligar exaustor", { description: errorMessage });
      throw err;
    }
  }, []);

  const handleExhaustStatus = useCallback(async (id: string): Promise<ExhaustRunningStatus> => {
    const normalizedId = id.trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "_");
    notify.info("Consultando status", { description: `Exaustor ${normalizedId}.` });

    try {
      const processStatus = await api.exhaustProcessStatus();
      const memory = processStatus.memory.find((item) => item.id === normalizedId) ?? null;

      const result = {
        id: normalizedId,
        isRunning: Boolean(memory),
        remainingMinutes: memory?.remainingMinutes ?? null,
        generatedAt: processStatus.generatedAt,
        activeCount: processStatus.total,
        memory,
      };

      if (result.isRunning) {
        notify.success("Exaustor em funcionamento", {
          description: `${normalizedId} com ${result.remainingMinutes ?? "--"} min restante(s).`,
        });
      } else {
        notify.warning("Exaustor desligado", {
          description: `${normalizedId} nao consta na memoria de acionamentos.`,
        });
      }

      return result;
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      notify.error("Erro ao consultar status do exaustor", { description: errorMessage });
      throw err;
    }
  }, []);

  const value: DashboardContextType = {
    doors,
    gates,
    exhaustDevices,
    latestGateAccesses,
    latestAccessAutoRefresh,
    setLatestAccessAutoRefresh,
    lastAction,
    apiError,
    refreshing,
    loadDevices,
    handleOpenDoor,
    handleOpenGate,
    handleExhaustOn,
    handleExhaustOff,
    handleExhaustStatus,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}
