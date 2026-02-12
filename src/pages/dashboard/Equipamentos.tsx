import { useEffect, useMemo, useRef, useState } from "react";
import { DoorOpen, Warehouse, Fan, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDashboard } from "@/contexts/DashboardContext";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";

type FilterType = "all" | "door" | "gate" | "exhaust";

type DeviceRow = {
  id: string;
  tipo: "Porta" | "Portão" | "Exaustor";
  nome: string;
  ip: string;
  porta: number | null;
  statusCode: number | null;
  online: boolean;
  error: string | null;
  filter: FilterType;
};

type DeviceStatusTone = "online" | "offline" | "warning";

export default function Equipamentos() {
  const { doors, gates, exhaustDevices, loadDevices, refreshing } = useDashboard();
  const [filter, setFilter] = useState<FilterType>("all");
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null);
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
      tipo: "Portão",
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

  const getDeviceStatusTone = (device: DeviceRow): DeviceStatusTone => {
    if (!device.online) return "offline";
    if (device.error || (device.statusCode !== null && device.statusCode !== 200)) return "warning";
    return "online";
  };

  const getDeviceStatusPresentation = (device: DeviceRow) => {
    const tone = getDeviceStatusTone(device);

    if (tone === "online") {
      return {
        label: "Online",
        className: "rounded-full border-none state-success-soft px-3 py-1 typo-caption font-medium",
        dotClassName: "bg-status-success-solid",
      };
    }

    if (tone === "warning") {
      return {
        label: "Alerta",
        className: "rounded-full border-none state-warning-soft px-3 py-1 typo-caption font-medium",
        dotClassName: "bg-status-warning-soft-foreground",
      };
    }

    return {
      label: "Offline",
      className: "rounded-full border-none state-danger-soft px-3 py-1 typo-caption font-medium",
      dotClassName: "bg-status-danger-solid",
    };
  };

  const onRefresh = async () => {
    setManualRefreshing(true);
    try {
      await loadDevices();
    } finally {
      setManualRefreshing(false);
    }
  };

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Equipamentos"
        description="Tabela única de dispositivos com filtro por tipo."
      />

      <div className="flex items-center justify-between gap-2">
        <p className="typo-caption">
          {updatedAt ? `Atualizado em: ${new Date(updatedAt).toLocaleString("pt-BR")}` : "Atualizado em: --"}
        </p>
        <Button
          variant="outline"
          onClick={() => void onRefresh()}
          disabled={refreshLoading}
          className="h-9 max-sm:h-8 max-sm:w-8 max-sm:border-0 max-sm:bg-transparent max-sm:p-0"
          aria-label="Atualizar"
        >
          <RefreshCw className={`h-4 w-4 ${refreshLoading ? "animate-spin" : ""} sm:mr-2`} />
          <span className="hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as FilterType)}>
        <TabsList className="grid h-10 w-full grid-cols-4 sm:inline-flex sm:w-auto">
          <TabsTrigger value="all" className="w-full">Todos</TabsTrigger>
          <TabsTrigger value="door" className="w-full gap-1"><DoorOpen className="h-3.5 w-3.5" />Portas</TabsTrigger>
          <TabsTrigger value="gate" className="w-full gap-1"><Warehouse className="h-3.5 w-3.5" />Portões</TabsTrigger>
          <TabsTrigger value="exhaust" className="w-full gap-1"><Fan className="h-3.5 w-3.5" />Exaustores</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="hidden grid-cols-7 gap-3 border-b bg-muted px-4 py-3 typo-label text-muted-foreground sm:grid">
          <span>Tipo</span>
          <span className="col-span-2">Equipamento</span>
          <span>IP</span>
          <span>Porta</span>
          <span>HTTP</span>
          <span>Status</span>
        </div>

        {initialLoading ? (
          <div className="px-4 py-8">
            <div className="flex items-center justify-center gap-2 typo-body text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando equipamentos...
            </div>
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="px-4 py-8 typo-body text-muted-foreground">Nenhum equipamento para o filtro selecionado.</div>
        ) : (
          <>
            <div className="sm:hidden">
              {filteredDevices.map((device, index) => (
                (() => {
                  const statusPresentation = getDeviceStatusPresentation(device);
                  return (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => setSelectedDevice(device)}
                  className={`w-full px-4 py-3 text-left ${index !== filteredDevices.length - 1 ? "border-b" : ""}`}
                >
                  <div className="flex items-center justify-between gap-3 typo-body">
                    <div className="min-w-0">
                      <p className="typo-caption text-muted-foreground">{device.tipo}</p>
                      <p className="truncate font-semibold text-foreground">{device.nome}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={statusPresentation.className}
                    >
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${statusPresentation.dotClassName}`} />
                      {statusPresentation.label}
                    </Badge>
                  </div>
                </button>
                  );
                })()
              ))}
            </div>

            <div className="hidden sm:block">
              {filteredDevices.map((device, index) => (
                (() => {
                  const statusPresentation = getDeviceStatusPresentation(device);
                  return (
                <div key={device.id} className={`grid grid-cols-7 items-center gap-3 px-4 py-3 typo-body ${index !== filteredDevices.length - 1 ? "border-b" : ""}`}>
                  <div className="text-muted-foreground">{device.tipo}</div>
                  <div className="col-span-2">
                    <p className="font-semibold text-foreground">{device.nome}</p>
                    {device.error ? <p className="typo-caption text-status-danger-soft-foreground">Erro: {device.error}</p> : null}
                  </div>
                  <div className="text-foreground">{device.ip}</div>
                  <div className="text-foreground">{device.porta ?? "--"}</div>
                  <div className="text-foreground">{device.statusCode ?? "--"}</div>
                  <div>
                    <Badge
                      variant="outline"
                      className={statusPresentation.className}
                    >
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${statusPresentation.dotClassName}`} />
                      {statusPresentation.label}
                    </Badge>
                  </div>
                </div>
                  );
                })()
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={Boolean(selectedDevice)} onOpenChange={(open) => { if (!open) setSelectedDevice(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do equipamento</DialogTitle>
            <DialogDescription>{selectedDevice ? selectedDevice.nome : "Selecione um equipamento."}</DialogDescription>
          </DialogHeader>

          {selectedDevice ? (
            <div className="space-y-2 typo-body">
              <p><strong>Tipo:</strong> {selectedDevice.tipo}</p>
              <p><strong>Equipamento:</strong> {selectedDevice.nome}</p>
              <p><strong>IP:</strong> {selectedDevice.ip}</p>
              <p><strong>Porta:</strong> {selectedDevice.porta ?? "--"}</p>
              <p><strong>HTTP:</strong> {selectedDevice.statusCode ?? "--"}</p>
              <p><strong>Status:</strong> {selectedDevice.online ? "Online" : "Offline"}</p>
              {selectedDevice.error ? <p className="typo-caption text-status-danger-soft-foreground">Erro: {selectedDevice.error}</p> : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
