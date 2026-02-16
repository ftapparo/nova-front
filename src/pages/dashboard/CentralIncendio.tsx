import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, RefreshCw, RotateCcw, ShieldAlert, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cieApi, type CieLogItem, type CieLogType } from "@/services/api";
import { notify } from "@/lib/notify";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";

type DashboardLogTab = Exclude<CieLogType, "bloqueio">;

const LOG_TABS: Array<{ value: DashboardLogTab; label: string }> = [
  { value: "operacao", label: "Operação" },
  { value: "alarme", label: "Alarme" },
  { value: "falha", label: "Falha" },
  { value: "supervisao", label: "Supervisão" },
];

const COUNTER_KEYS: Array<{ key: "alarme" | "falha" | "bloqueio" | "supervisao"; label: string }> = [
  { key: "alarme", label: "Alarme" },
  { key: "falha", label: "Falha" },
  { key: "bloqueio", label: "Bloqueio" },
  { key: "supervisao", label: "Supervisão" },
];

const EVENT_TYPE_LABEL: Record<CieLogType, string> = {
  operacao: "Evento de operação",
  alarme: "Evento de alarme",
  falha: "Disp. em Falha",
  supervisao: "Evento de supervisão",
  bloqueio: "Evento de bloqueio",
};

const toFriendlyError = (error: unknown): string => {
  const fallback = "Não foi possível comunicar com a Central de Incêndio no momento.";
  if (!(error instanceof Error)) return fallback;

  const raw = error.message || "";
  const message = raw.toLowerCase();

  if (message.includes("network error")) {
    return "Central offline. Não foi possível conectar ao serviço da central.";
  }

  if (message.includes("timeout")) {
    return "Central sem resposta. Verifique a rede e tente novamente.";
  }

  if (message.includes("nao mapeado") || message.includes("não mapeado")) {
    return "Comando não configurado na central. Solicite ajuste técnico.";
  }

  if (message.includes("erro ao chamar rota cie")) {
    return "Serviço da central indisponível no momento.";
  }

  return raw || fallback;
};

const formatDate = (value?: string | null): string => {
  if (!value) return "--";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "--";
  return dt.toLocaleDateString("pt-BR");
};

const formatTime = (value?: string | null): string => {
  if (!value) return "--";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "--";
  return dt.toLocaleTimeString("pt-BR", { hour12: false });
};

const formatPanelDate = (timestamp?: number | null): string => {
  if (!timestamp || !Number.isFinite(timestamp)) return "--";
  return new Date(timestamp).toLocaleDateString("pt-BR");
};

const formatPanelTime = (timestamp?: number | null): string => {
  if (!timestamp || !Number.isFinite(timestamp)) return "--";
  return new Date(timestamp).toLocaleTimeString("pt-BR", { hour12: false });
};

const normalizeLabel = (value?: string | null): string => {
  const text = String(value ?? "").trim();
  return text || "--";
};

const buildEventAddress = (log: CieLogItem): string => {
  const loop = Number.isFinite(log.loop ?? NaN) ? `L${log.loop}` : "L-";
  const address = Number.isFinite(log.address ?? NaN) ? `D${log.address}` : "D-";
  return `${loop}${address}`;
};

export default function CentralIncendio() {
  const queryClient = useQueryClient();
  const [logTab, setLogTab] = useState<DashboardLogTab>("falha");
  const [tabOpenedAt, setTabOpenedAt] = useState<number>(Date.now());

  const panelQuery = useQuery({
    queryKey: ["cie", "panel"],
    queryFn: cieApi.panel,
    refetchInterval: 4000,
    staleTime: 2000,
  });

  const logsQuery = useQuery({
    queryKey: ["cie", "logs", logTab],
    queryFn: () => cieApi.logs(logTab, 20),
    refetchInterval: 2000,
    staleTime: 2000,
  });

  const commandMutation = useMutation({
    mutationFn: async (action: "silenceBip" | "alarmGeneral" | "silenceSiren" | "restartCentral") => {
      if (action === "silenceBip") return cieApi.silenceBip();
      if (action === "alarmGeneral") return cieApi.alarmGeneral();
      if (action === "silenceSiren") return cieApi.silenceSiren();
      return cieApi.restartCentral();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cie", "panel"] }),
        queryClient.invalidateQueries({ queryKey: ["cie", "logs"] }),
      ]);
    },
  });

  const panel = panelQuery.data;
  const counters = panel?.counters;
  const logs = logsQuery.data?.items ?? [];
  const highlightedFailure = panel?.latestFailureEvent ?? null;
  const panelErrorMessage = panelQuery.error ? toFriendlyError(panelQuery.error) : null;
  const logsErrorMessage = logsQuery.error ? toFriendlyError(logsQuery.error) : null;
  const online = panelQuery.isError ? false : (panel?.online ?? false);

  const latestEvents = useMemo(() => logs.slice(0, 20), [logs]);
  const isLoading = panelQuery.isLoading && logsQuery.isLoading;
  const tabElapsedMs = Date.now() - tabOpenedAt;

  useEffect(() => {
    setTabOpenedAt(Date.now());
  }, [logTab]);

  const targetEventCount = useMemo(() => {
    if (logTab === "operacao") return 20;
    const mappedKey = logTab as "alarme" | "falha" | "supervisao";
    const counterValue = counters?.[mappedKey] ?? 0;
    return Math.max(0, Math.min(20, Number(counterValue) || 0));
  }, [counters, logTab]);

  const waitingBatchLoad = online
    && !logsErrorMessage
    && targetEventCount > 0
    && latestEvents.length < targetEventCount
    && tabElapsedMs < 12000;

  const handleManualRefresh = async () => {
    await Promise.all([panelQuery.refetch(), logsQuery.refetch()]);
    notify.success("Central atualizada", { description: "Dados sincronizados com sucesso." });
  };

  const runCommand = async (
    action: "silenceBip" | "alarmGeneral" | "silenceSiren" | "restartCentral",
    label: string
  ) => {
    try {
      await commandMutation.mutateAsync(action);
      notify.success("Comando enviado", { description: `${label} executado com sucesso.` });
    } catch (error) {
      const message = toFriendlyError(error);
      notify.error("Falha no comando", { description: message });
    }
  };

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Central de Incêndio"
        description="Monitoramento e comando da CIE2500 em tempo real."
        actions={(
          <Button
            variant="outline"
            onClick={() => void handleManualRefresh()}
            disabled={panelQuery.isFetching || logsQuery.isFetching}
            className="h-9"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${(panelQuery.isFetching || logsQuery.isFetching) ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>{panel?.central?.nome?.trim() || "NOVA RESIDENCE"}</CardTitle>
                <Badge
                  variant="outline"
                  className={online
                    ? "rounded-full border-none state-success-soft px-3 py-1 typo-caption font-medium"
                    : "rounded-full border-none state-danger-soft px-3 py-1 typo-caption font-medium"}
                >
                  <span className={`mr-2 inline-block h-2 w-2 rounded-full ${online ? "bg-status-success-solid" : "bg-status-danger-solid"}`} />
                  {online ? "Online" : "Offline"}
                </Badge>
              </div>
              <CardDescription>
                {panel?.reconnecting ? `Reconectando... tentativa ${panel.reconnectAttempt}` : "Status atual da central"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {panelErrorMessage ? (
                <div className="rounded-lg border state-danger-soft px-4 py-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-danger-soft-foreground" />
                    <div>
                      <p className="typo-label uppercase text-status-danger-soft-foreground">Central Offline</p>
                      <p className="typo-body font-semibold text-foreground">{panelErrorMessage}</p>
                      <p className="typo-caption text-muted-foreground">
                        Oriente o porteiro/zelador/síndico a verificar o serviço da central e a conexão de rede.
                      </p>
                    </div>
                  </div>
                </div>
              ) : highlightedFailure ? (
                <div className="rounded-lg border state-warning-soft px-4 py-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-warning-soft-foreground" />
                    <div>
                      <p className="typo-label uppercase text-status-warning-soft-foreground">Sistema em Falha</p>
                      <p className="typo-body font-semibold text-foreground">
                        {buildEventAddress(highlightedFailure)} - {normalizeLabel(highlightedFailure.zoneName)}
                      </p>
                      <p className="typo-caption text-muted-foreground">{EVENT_TYPE_LABEL[highlightedFailure.type]}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/60 px-4 py-3 typo-body text-muted-foreground">
                  Nenhuma falha ativa registrada.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {COUNTER_KEYS.map((item) => (
                  <div key={item.key} className="rounded-lg border bg-muted/40 px-3 py-2 text-center">
                    <p className="typo-stat-value">{counters?.[item.key] ?? 0}</p>
                    <p className="typo-caption uppercase">{item.label}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-card p-3">
                  <p className="typo-caption uppercase text-muted-foreground">Modelo</p>
                  <p className="typo-body font-medium">{normalizeLabel(panel?.central?.modelo)}</p>
                  <p className="mt-2 typo-caption uppercase text-muted-foreground">IP</p>
                  <p className="typo-body font-medium">{normalizeLabel(panel?.central?.ip)}</p>
                  <p className="mt-2 typo-caption uppercase text-muted-foreground">MAC</p>
                  <p className="typo-body font-medium">{normalizeLabel(panel?.central?.mac)}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="typo-caption uppercase text-muted-foreground">Data</p>
                  <p className="typo-body font-medium">{formatPanelDate(panel?.dataHora?.timestamp)}</p>
                  <p className="mt-2 typo-caption uppercase text-muted-foreground">Hora</p>
                  <p className="typo-body font-medium">{formatPanelTime(panel?.dataHora?.timestamp)}</p>
                  {panel?.lastError ? (
                    <>
                      <p className="mt-2 typo-caption uppercase text-muted-foreground">Último erro</p>
                      <p className="typo-caption text-status-danger-soft-foreground">{panel.lastError}</p>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button
                  variant="outline"
                  disabled={commandMutation.isPending}
                  onClick={() => void runCommand("silenceBip", "Silenciar Bip Interno")}
                  className="h-11"
                >
                  <VolumeX className="mr-2 h-4 w-4" />
                  Silenciar Bip
                </Button>
                <Button
                  variant="outline"
                  disabled={commandMutation.isPending}
                  onClick={() => void runCommand("alarmGeneral", "Alarme Geral")}
                  className="h-11"
                >
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Alarme Geral
                </Button>
                <Button
                  variant="outline"
                  disabled={commandMutation.isPending}
                  onClick={() => void runCommand("silenceSiren", "Silenciar Sirene")}
                  className="h-11"
                >
                  <Bell className="mr-2 h-4 w-4" />
                  Silenciar Sirene
                </Button>
                <Button
                  variant="outline"
                  disabled={commandMutation.isPending}
                  onClick={() => void runCommand("restartCentral", "Reiniciar Central")}
                  className="h-11"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reiniciar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-2">
          <Card className="h-full min-h-[540px] shadow-sm">
            <CardHeader className="space-y-3">
              <CardTitle>Eventos</CardTitle>
              <Tabs value={logTab} onValueChange={(value) => setLogTab(value as DashboardLogTab)}>
                <TabsList className="grid h-10 w-full grid-cols-4">
                  {LOG_TABS.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value} className="w-full">
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              <div className="max-h-[540px] overflow-y-auto pr-1">
                {isLoading || waitingBatchLoad ? (
                  <div className="rounded-lg border bg-muted p-4 typo-body text-muted-foreground">
                    Carregando os últimos registros de {LOG_TABS.find((t) => t.value === logTab)?.label ?? "eventos"}...
                  </div>
                ) : latestEvents.length === 0 ? (
                  <div className="rounded-lg border bg-muted p-4 typo-body text-muted-foreground">
                    Sem eventos para o filtro selecionado.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {latestEvents.map((event, index) => (
                      <div key={event.key} className="rounded-lg border bg-muted/40 px-3 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="typo-caption text-muted-foreground">{index + 1}</p>
                            <p className="typo-body font-semibold text-foreground">
                              {buildEventAddress(event)} - {normalizeLabel(event.zoneName)}
                            </p>
                            <p className="typo-caption text-muted-foreground">
                              {EVENT_TYPE_LABEL[event.type]}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="typo-caption">{formatDate(event.occurredAt)}</p>
                            <p className="typo-caption">{formatTime(event.occurredAt)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {logsErrorMessage ? (
                <div className="mt-3 rounded-lg border state-danger-soft px-4 py-3 typo-caption">
                  {logsErrorMessage}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
