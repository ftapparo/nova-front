import { useState, useCallback, useEffect } from "react";
import AppBar from "@/components/dashboard/AppBar";
import OperationalPanel from "@/components/dashboard/OperationalPanel";
import DoorGateControl from "@/components/dashboard/DoorGateControl";
import ExhaustControl from "@/components/dashboard/ExhaustControl";
import { api, type DoorItem, type GateItem } from "@/services/api";
import { notify } from "@/lib/notify";

export default function Dashboard() {
  const [doors, setDoors] = useState<DoorItem[]>([]);
  const [gates, setGates] = useState<GateItem[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const getErrorMessage = (err: unknown) => (err instanceof Error ? err.message : "Erro desconhecido");

  const loadDevices = useCallback(async () => {
    setRefreshing(true);
    setApiError(null);
    notify.info("Atualizando dispositivos", { description: "Consultando portas e portoes." });

    try {
      const status = await api.controlStatus();
      const d = status?.doors || [];
      const g = status?.gates || [];
      setDoors(d);
      setGates(g);
      setLastAction("Dispositivos atualizados com sucesso.");

      if ((d?.length ?? 0) === 0 && (g?.length ?? 0) === 0) {
        notify.warning("Atualizacao concluida", { description: "Nenhum dispositivo foi retornado pela API." });
      } else {
        notify.success("Dispositivos atualizados", { description: `${d?.length ?? 0} porta(s) e ${g?.length ?? 0} portao(oes).` });
      }
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      setApiError(`Falha ao carregar dispositivos: ${errorMessage}`);
      notify.error("Falha ao atualizar dispositivos", { description: errorMessage });
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const handleOpenDoor = async (id: string) => {
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
    }
  };

  const handleOpenGate = async (id: string, autoClose: number) => {
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
    }
  };

  const handleExhaustOn = async (block: string, apartment: string, duration: number) => {
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
    }
  };

  const handleExhaustOff = async (block: string, apartment: string) => {
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
    }
  };

  const handleExhaustStatus = async (id: string) => {
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
        notify.warning("Exaustor desligado", { description: `${normalizedId} nao consta na memoria de acionamentos.` });
      }

      return result;
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      notify.error("Erro ao consultar status do exaustor", { description: errorMessage });
      throw err;
    }
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
