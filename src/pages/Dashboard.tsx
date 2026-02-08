import { useState, useCallback, useEffect } from "react";
import AppBar from "@/components/dashboard/AppBar";
import OperationalPanel from "@/components/dashboard/OperationalPanel";
import DoorGateControl from "@/components/dashboard/DoorGateControl";
import ExhaustControl from "@/components/dashboard/ExhaustControl";
import { api, type DoorItem, type GateItem } from "@/services/api";

export default function Dashboard() {
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

  useEffect(() => { loadDevices(); }, [loadDevices]);

  const handleOpenDoor = async (id: string) => {
    setApiError(null);
    try {
      await api.openDoor(id);
      const name = doors.find((d) => String(d.sequencia) === id)?.nome ?? id;
      setLastAction(`Porta "${name}" aberta com sucesso.`);
    } catch (err: unknown) {
      setApiError(`Erro ao abrir porta: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  };

  const handleOpenGate = async (id: string, autoClose: number) => {
    setApiError(null);
    try {
      await api.openGate(id, autoClose);
      const name = gates.find((g) => String(g.sequencia) === id)?.nome ?? id;
      setLastAction(`Portão "${name}" aberto (fechamento em ${autoClose}s).`);
    } catch (err: unknown) {
      setApiError(`Erro ao abrir portão: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  };

  const handleExhaustOn = async (block: string, apartment: string, duration: number) => {
    setApiError(null);
    try {
      await api.exhaustorOn(block, apartment, duration);
      setLastAction(`Exaustor ${block}${apartment} ligado por ${duration} min.`);
    } catch (err: unknown) {
      setApiError(`Erro ao ligar exaustor: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  };

  const handleExhaustOff = async (block: string, apartment: string) => {
    setApiError(null);
    try {
      await api.exhaustorOff(block, apartment);
      setLastAction(`Exaustor ${block}${apartment} desligado.`);
    } catch (err: unknown) {
      setApiError(`Erro ao desligar exaustor: ${err instanceof Error ? err.message : "Erro desconhecido"}`);
    }
  };

  const handleExhaustStatus = async (id: string) => {
    return await api.exhaustorStatus(id);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppBar />
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 md:px-6">
        <OperationalPanel
          doorCount={doors.length}
          gateCount={gates.length}
          lastAction={lastAction}
          apiError={apiError}
          onRefresh={loadDevices}
          refreshing={refreshing}
        />
        <DoorGateControl doors={doors} gates={gates} onOpenDoor={handleOpenDoor} onOpenGate={handleOpenGate} />
        <ExhaustControl onTurnOn={handleExhaustOn} onTurnOff={handleExhaustOff} onStatus={handleExhaustStatus} />
      </main>
    </div>
  );
}
