import { useEffect, useMemo, useRef, useState } from "react";
import { DoorOpen, Warehouse, Fan, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboard } from "@/contexts/DashboardContext";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";

type FilterType = "all" | "door" | "gate" | "exhaust";

type DeviceRow = {
  id: string;
  tipo: "Porta" | "Portao" | "Exaustor";
  nome: string;
  ip: string;
  porta: number | null;
  statusCode: number | null;
  online: boolean;
  error: string | null;
  filter: FilterType;
};

export default function Equipamentos() {
  const { doors, gates, exhaustDevices, loadDevices, refreshing } = useDashboard();
  const [filter, setFilter] = useState<FilterType>("all");
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const previousRefreshing = useRef(refreshing);

  useEffect(() => {
    if (!refreshing) setHasLoadedInitialData(true);
  }, [refreshing]);

  useEffect(() => {
    if (previousRefreshing.current && !refreshing) {
      setUpdatedAt(Date.now());
    }
    previousRefreshing.current = refreshing;
  }, [refreshing]);

  const devices = useMemo<DeviceRow[]>(() => {
    const doorRows: DeviceRow[] = doors.map((d) => ({
      id: `door-${d.id}`,
      tipo: "Porta",
      nome: d.nome,
      ip: d.ip || "--",
      porta: d.porta ?? null,
      statusCode: d.statusCode,
      online: d.online,
      error: d.error,
      filter: "door",
    }));

    const gateRows: DeviceRow[] = gates.map((g) => ({
      id: `gate-${g.id}`,
      tipo: "Portao",
      nome: g.nome,
      ip: g.ip || "--",
      porta: g.porta ?? null,
      statusCode: g.statusCode,
      online: g.online,
      error: g.error,
      filter: "gate",
    }));

    const exhaustRows: DeviceRow[] = exhaustDevices.map((e) => ({
      id: `exhaust-${e.id}`,
      tipo: "Exaustor",
      nome: e.nome || e.id,
      ip: e.host || "--",
      porta: e.port ?? null,
      statusCode: e.statusCode,
      online: e.online,
      error: e.error,
      filter: "exhaust",
    }));

    return [...doorRows, ...gateRows, ...exhaustRows].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [doors, gates, exhaustDevices]);

  const filteredDevices = useMemo(() => {
    if (filter === "all") return devices;
    return devices.filter((d) => d.filter === filter);
  }, [devices, filter]);

  const initialLoading = !hasLoadedInitialData && refreshing;
  const refreshLoading = initialLoading || manualRefreshing;

  const onRefresh = async () => {
    setManualRefreshing(true);
    try {
      await loadDevices();
    } finally {
      setManualRefreshing(false);
    }
  };

  return (
    <PageContainer density="wide">
      <PageHeader
        title="Equipamentos"
        description="Tabela unica de dispositivos com filtro por tipo."
        actions={
          <Button variant="outline" onClick={() => void onRefresh()} disabled={refreshLoading} className="h-9">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      <p className="text-xs text-muted-foreground">
        {updatedAt ? `Atualizado em: ${new Date(updatedAt).toLocaleString("pt-BR")}` : "Atualizado em: --"}
      </p>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
        <TabsList className="h-9">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="door" className="gap-1"><DoorOpen className="h-3.5 w-3.5" />Portas</TabsTrigger>
          <TabsTrigger value="gate" className="gap-1"><Warehouse className="h-3.5 w-3.5" />Portoes</TabsTrigger>
          <TabsTrigger value="exhaust" className="gap-1"><Fan className="h-3.5 w-3.5" />Exaustores</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="grid grid-cols-7 gap-3 border-b bg-muted px-4 py-3 text-xs font-medium text-muted-foreground">
          <span>Tipo</span>
          <span className="col-span-2">Equipamento</span>
          <span>IP</span>
          <span>Porta</span>
          <span>HTTP</span>
          <span>Status</span>
        </div>

        {initialLoading ? (
          <div className="px-4 py-8">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando equipamentos...
            </div>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">Nenhum equipamento para o filtro selecionado.</div>
        ) : (
          filteredDevices.map((device, index) => (
            <div key={device.id} className={`grid grid-cols-7 items-center gap-3 px-4 py-3 text-sm ${index !== filteredDevices.length - 1 ? "border-b" : ""}`}>
              <div className="text-muted-foreground">{device.tipo}</div>
              <div className="col-span-2">
                <p className="font-semibold text-foreground">{device.nome}</p>
                {device.error ? <p className="text-xs text-rose-700">Erro: {device.error}</p> : null}
              </div>
              <div className="text-foreground">{device.ip}</div>
              <div className="text-foreground">{device.porta ?? "--"}</div>
              <div className="text-foreground">{device.statusCode ?? "--"}</div>
              <div>
                <Badge
                  className={
                    device.online
                      ? "rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
                      : "rounded-full bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50"
                  }
                >
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${device.online ? "bg-emerald-600" : "bg-rose-600"}`} />
                  {device.online ? "Online" : "Offline"}
                </Badge>
              </div>
            </div>
          ))
        )}
      </div>
    </PageContainer>
  );
}
