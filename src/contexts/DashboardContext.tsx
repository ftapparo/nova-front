import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { api, type DoorItem, type GateItem } from "@/services/api";

interface DashboardContextType {
  doors: DoorItem[];
  gates: GateItem[];
  lastAction: string | null;
  apiError: string | null;
  refreshing: boolean;
  loadDevices: () => Promise<void>;
  handleOpenDoor: (id: string) => Promise<void>;
  handleOpenGate: (id: string, autoClose: number) => Promise<void>;
  handleExhaustOn: (block: string, apartment: string, duration: number) => Promise<void>;
  handleExhaustOff: (block: string, apartment: string) => Promise<void>;
  handleExhaustStatus: (id: string) => Promise<unknown>;
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
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDevices = useCallback(async () => {
    setRefreshing(true);
    setApiError(null);
    try {
      const [d, g] = await Promise.all([api.listDoors(), api.listGates()]);
      setDoors(d || []);
      setGates(g || []);
      setLastAction("Dispositivos atualizados com sucesso.");
    } catch (err: unknown) {
      setApiError(`Falha ao carregar dispositivos: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleOpenDoor = useCallback(async (id: string) => {
    setApiError(null);
    try {
      await api.openDoor(id);
      const name = doors.find((d) => String(d.sequencia) === id)?.nome ?? id;
      setLastAction(`Porta "${name}" aberta com sucesso.`);
    } catch (err: unknown) {
      setApiError(`Erro ao abrir porta: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
      throw err;
    }
  }, [doors]);

  const handleOpenGate = useCallback(async (id: string, autoClose: number) => {
    setApiError(null);
    try {
      await api.openGate(id, autoClose);
      const name = gates.find((g) => String(g.sequencia) === id)?.nome ?? id;
      setLastAction(`Portão "${name}" aberto (fechamento em ${autoClose}s).`);
    } catch (err: unknown) {
      setApiError(`Erro ao abrir portão: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
      throw err;
    }
  }, [gates]);

  const handleExhaustOn = useCallback(async (block: string, apartment: string, duration: number) => {
    setApiError(null);
    try {
      await api.exhaustorOn(block, apartment, duration);
      setLastAction(`Exaustor ${block}${apartment} ligado por ${duration} min.`);
    } catch (err: unknown) {
      setApiError(`Erro ao ligar exaustor: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
      throw err;
    }
  }, []);

  const handleExhaustOff = useCallback(async (block: string, apartment: string) => {
    setApiError(null);
    try {
      await api.exhaustorOff(block, apartment);
      setLastAction(`Exaustor ${block}${apartment} desligado.`);
    } catch (err: unknown) {
      setApiError(`Erro ao desligar exaustor: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
      throw err;
    }
  }, []);

  const handleExhaustStatus = useCallback(async (id: string) => {
    return await api.exhaustorStatus(id);
  }, []);

  const value: DashboardContextType = {
    doors,
    gates,
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
