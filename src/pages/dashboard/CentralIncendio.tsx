import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, Loader2, RefreshCw, RotateCcw, ShieldAlert, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cieApi, type CieLogItem, type CieLogType } from "@/services/api";
import { notify } from "@/lib/notify";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";

type DashboardLogTab = Exclude<CieLogType, "bloqueio">;
type CurrentStateKey = "alarme" | "falha" | "bloqueio" | "supervisao";
type SecondaryCardMode = "estado-atual" | "registro-eventos";

const LOG_TABS: Array<{ value: DashboardLogTab; label: string }> = [
  { value: "operacao", label: "Operação" },
  { value: "alarme", label: "Alarme" },
  { value: "falha", label: "Falha" },
  { value: "supervisao", label: "Supervisão" },
];

const COUNTER_KEYS: Array<{ key: CurrentStateKey; label: string }> = [
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

const DEVICE_TYPE_LABEL: Record<number, string> = {
  1: "Sensor de Fumaca",
  2: "Sensor de Temperatura",
  3: "Acionador Manual",
  4: "Modulo de Zona",
  5: "Modulo de Entrada",
  9: "Modulo de entrada ou saida",
  10: "Sinalizador Audiovisual",
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

  if (message.includes("nao mapeado") || message.includes("nÃ£o mapeado")) {
    return "Comando não configurado na central. Solicite ajuste técnico.";
  }

  if (message.includes("statusbotaonaoconfigurado")) {
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

const getDeviceTypeLabel = (log: CieLogItem): string => {
  if (typeof log.deviceTypeLabel === "string" && log.deviceTypeLabel.trim()) {
    return log.deviceTypeLabel.trim();
  }
  const code = log.deviceClassification?.typeCode ?? null;
  if (typeof code === "number" && Number.isFinite(code) && DEVICE_TYPE_LABEL[code]) {
    return DEVICE_TYPE_LABEL[code];
  }
  return normalizeLabel(log.deviceClassification?.typeLabel || log.deviceClassification?.resolvedLabel);
};

export default function CentralIncendio() {
  const queryClient = useQueryClient();
  const [logTab, setLogTab] = useState<DashboardLogTab>("falha");
  const [currentStateTab, setCurrentStateTab] = useState<CurrentStateKey>("alarme");
  const [secondaryMode, setSecondaryMode] = useState<SecondaryCardMode>("estado-atual");
  const [tabOpenedAt, setTabOpenedAt] = useState<number>(Date.now());
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [lastStableFailure, setLastStableFailure] = useState<CieLogItem | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<CieLogItem | null>(null);
  const [confirmAlarmOpen, setConfirmAlarmOpen] = useState(false);
  const [restartGraceUntil, setRestartGraceUntil] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [forcedOffline, setForcedOffline] = useState(false);
  const [consecutivePanelFailures, setConsecutivePanelFailures] = useState(0);

  const panelQuery = useQuery({
    queryKey: ["cie", "panel"],
    queryFn: cieApi.panel,
    refetchInterval: 4000,
    staleTime: 2000,
  });

  const panel = panelQuery.data;
  const panelRestartUntil = panel?.restartingUntil ?? null;
  const panelRestartingActive = Boolean(panel?.restarting) && Number(panelRestartUntil ?? 0) > nowMs;
  const forceOfflineByFailures = !panelRestartingActive && consecutivePanelFailures >= 2;
  const online = !(forcedOffline || forceOfflineByFailures) && panel?.online === true;

  const isLogsMode = secondaryMode === "registro-eventos";
  const activeLogType: CieLogType = isLogsMode ? logTab : currentStateTab;

  const logsQuery = useQuery({
    queryKey: ["cie", "logs", secondaryMode, activeLogType],
    queryFn: () => cieApi.logs(activeLogType, 20),
    enabled: isLogsMode && online,
    refetchInterval: 2000,
    staleTime: 2000,
  });

  const commandMutation = useMutation({
    mutationFn: async (action: "silenceBip" | "alarmGeneral" | "silenceSiren" | "releaseSiren" | "restartCentral") => {
      if (action === "silenceBip") return cieApi.silenceBip();
      if (action === "alarmGeneral") return cieApi.alarmGeneral();
      if (action === "silenceSiren") return cieApi.silenceSiren();
      if (action === "releaseSiren") return cieApi.releaseSiren();
      return cieApi.restartCentral();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["cie", "panel"] }),
        queryClient.invalidateQueries({ queryKey: ["cie", "logs"] }),
      ]);
    },
  });

  const restartUntil = Math.max(restartGraceUntil ?? 0, panelRestartUntil ?? 0);
  const restarting = !online && (restartUntil > nowMs || panelRestartingActive);
  const hadPanelError = panelQuery.errorUpdatedAt > 0 || panelQuery.isError || panelQuery.isRefetchError;
  const initialLoading = panelQuery.isLoading && !panel && !hadPanelError && !forcedOffline;
  const isLoading = panelQuery.isLoading || (isLogsMode && logsQuery.isLoading);
  const offline = !initialLoading && !online && !restarting;
  const visiblePanel = online ? panel : null;
  const counters = visiblePanel?.counters;
  const logs = online && isLogsMode ? (logsQuery.data?.items ?? []) : [];
  const highlightedFailure = visiblePanel?.latestFailureEvent ?? null;
  const hasActiveFailure = Number(counters?.falha ?? 0) > 0;
  const hasActiveAlarm = Number(counters?.alarme ?? 0) > 0;
  const panelErrorMessage = panelQuery.error && !restarting ? toFriendlyError(panelQuery.error) : null;
  const logsErrorMessage = online && isLogsMode && logsQuery.error ? toFriendlyError(logsQuery.error) : null;

  const latestEvents = useMemo(() => logs.slice(0, 20), [logs]);
  const tabElapsedMs = Date.now() - tabOpenedAt;

  useEffect(() => {
    setTabOpenedAt(Date.now());
  }, [logTab]);

  const targetEventCount = useMemo(() => {
    if (activeLogType === "operacao") return 20;
    const mappedKey = activeLogType as "alarme" | "falha" | "supervisao" | "bloqueio";
    const counterValue = counters?.[mappedKey] ?? 0;
    return Math.max(0, Math.min(20, Number(counterValue) || 0));
  }, [counters, activeLogType]);

  const waitingBatchLoad = isLogsMode && online
    && !logsErrorMessage
    && targetEventCount > 0
    && latestEvents.length < targetEventCount
    && tabElapsedMs < 12000;

  useEffect(() => {
    if (!online || restarting || !hasActiveFailure) {
      setLastStableFailure(null);
      return;
    }

    if (highlightedFailure) {
      setLastStableFailure(highlightedFailure);
    }
  }, [online, restarting, highlightedFailure, hasActiveFailure]);

  const displayedFailure = hasActiveFailure ? (highlightedFailure ?? lastStableFailure) : null;

  useEffect(() => {
    const hasRefetchError = panelQuery.isRefetchError || panelQuery.isError;
    if (hasRefetchError) {
      setConsecutivePanelFailures((prev) => prev + 1);
    }
  }, [panelQuery.errorUpdatedAt, panelQuery.isRefetchError, panelQuery.isError]);

  useEffect(() => {
    const hasFreshSuccessAfterLastError = panelQuery.dataUpdatedAt > 0 && panelQuery.dataUpdatedAt > panelQuery.errorUpdatedAt;
    if (hasFreshSuccessAfterLastError) {
      setConsecutivePanelFailures(0);
    }
  }, [panelQuery.dataUpdatedAt, panelQuery.errorUpdatedAt]);

  useEffect(() => {
    if (panelRestartingActive) {
      setForcedOffline(false);
      setConsecutivePanelFailures(0);
      return;
    }

    if (forceOfflineByFailures) {
      setForcedOffline(true);
      return;
    }

    const hasFreshSuccessAfterLastError = panelQuery.dataUpdatedAt > 0 && panelQuery.dataUpdatedAt > panelQuery.errorUpdatedAt;
    if (hasFreshSuccessAfterLastError && panel?.online === true) {
      setForcedOffline(false);
    }
  }, [panelRestartingActive, forceOfflineByFailures, panelQuery.dataUpdatedAt, panelQuery.errorUpdatedAt, panel?.online]);

  useEffect(() => {
    if (online) {
      setRestartGraceUntil(null);
      return;
    }

    if (panelRestartUntil && panelRestartUntil > Date.now()) {
      setRestartGraceUntil(panelRestartUntil);
    }
  }, [online, panelRestartUntil]);

  useEffect(() => {
    if (!restarting) return;
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [restarting]);

  useEffect(() => {
    if (restartGraceUntil && nowMs >= restartGraceUntil) {
      setRestartGraceUntil(null);
    }
  }, [nowMs, restartGraceUntil]);

  const selectedStateCount = counters?.[currentStateTab] ?? 0;
  const selectedStateLabel = COUNTER_KEYS.find((item) => item.key === currentStateTab)?.label ?? "Estado";
  const selectedLogLabel = LOG_TABS.find((item) => item.value === logTab)?.label ?? "Eventos";
  const secondaryTitle = secondaryMode === "estado-atual"
    ? `Estado Atual de ${selectedStateLabel}`
    : `Registros de ${selectedLogLabel}`;
  const secondaryDescription = secondaryMode === "estado-atual"
    ? `Condição atual para ${selectedStateLabel.toLowerCase()}.`
    : `Últimos até 20 registros de ${selectedLogLabel.toLowerCase()}.`;
  const ledAlarmGeneralOn = visiblePanel?.leds?.alarmeGeral === true;
  const ledCentralSilenciadaOn = visiblePanel?.leds?.centralSilenciada === true;
  const ledSireneSilenciadaOn = visiblePanel?.leds?.sireneSilenciada === true;

  const handleManualRefresh = async () => {
    try {
      setManualRefreshing(true);
      if (isLogsMode) {
        await Promise.all([panelQuery.refetch(), logsQuery.refetch()]);
      } else {
        await panelQuery.refetch();
      }
      notify.success("Central atualizada", { description: "Dados sincronizados com sucesso." });
    } finally {
      setManualRefreshing(false);
    }
  };

  const runCommand = async (
    action: "silenceBip" | "alarmGeneral" | "silenceSiren" | "releaseSiren" | "restartCentral",
    label: string
  ) => {
    try {
      await commandMutation.mutateAsync(action);
      if (action === "restartCentral") {
        setRestartGraceUntil(Date.now() + 60000);
        setLastStableFailure(null);
        setSelectedDetail(null);
        setCurrentStateTab("alarme");
        setSecondaryMode("estado-atual");
        notify.success("Reinicialização iniciada", {
          description: "A central está reiniciando. Aguarde até 1 minuto para reconexão.",
        });
        return;
      }
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
            disabled={manualRefreshing}
            className="h-9"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${manualRefreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>{visiblePanel?.central?.nome?.trim() || "NOVA RESIDENCE"}</CardTitle>
                <Badge
                  variant="outline"
                  className={online
                    ? "rounded-full border-none state-success-soft px-3 py-1 typo-caption font-medium"
                    : restarting
                      ? "rounded-full border-none state-warning-soft px-3 py-1 typo-caption font-medium"
                      : "rounded-full border-none state-danger-soft px-3 py-1 typo-caption font-medium"}
                >
                  <span
                    className={`mr-2 inline-block h-2 w-2 rounded-full ${online
                      ? "bg-status-success-solid"
                      : restarting
                        ? "bg-status-warning-soft-foreground"
                        : "bg-status-danger-solid"}`}
                  />
                  {online ? "Online" : restarting ? "Reiniciando" : "Offline"}
                </Badge>
              </div>
              <CardDescription>
                {initialLoading
                  ? "Carregando status da central..."
                  : restarting
                    ? "Central reiniciando. Aguarde reconexão automática."
                    : visiblePanel?.reconnecting
                      ? `Reconectando... tentativa ${visiblePanel.reconnectAttempt}`
                      : "Status atual da central"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {initialLoading ? (
                <div className="rounded-lg border bg-muted px-4 py-3">
                  <div className="flex items-center gap-2 typo-body text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando status da central...
                  </div>
                </div>
              ) : restarting ? (
                <div className="rounded-lg border state-warning-soft border-status-warning-soft-border px-4 py-3">
                  <div className="flex items-start gap-3">
                    <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-status-warning-soft-foreground" />
                    <div>
                      <p className="typo-label uppercase text-status-warning-soft-foreground">Reiniciando central</p>
                      <p className="typo-body font-semibold text-status-warning-soft-foreground">
                        Comando de reinício enviado com sucesso. A central pode ficar indisponível por até 1 minuto.
                      </p>
                      <p className="typo-caption text-status-warning-soft-foreground">
                        Aguarde reconexão automática. Se ultrapassar 1 minuto, será exibido status offline.
                      </p>
                    </div>
                  </div>
                </div>
              ) : offline ? (
                <div className="rounded-lg border state-danger-soft border-status-danger-solid/40 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-danger-soft-foreground" />
                    <div>
                      <p className="typo-label uppercase text-status-danger-soft-foreground">Central Offline</p>
                      <p className="typo-body font-semibold text-status-danger-soft-foreground">
                        {panelErrorMessage || "Central offline. Não foi possível conectar ao serviço da central."}
                      </p>
                      <p className="typo-caption text-status-danger-soft-foreground">
                        Oriente o porteiro/zelador/síndico a verificar o serviço da central e a conexão de rede.
                      </p>
                    </div>
                  </div>
                </div>
              ) : displayedFailure ? (
                <div className={hasActiveAlarm
                  ? "rounded-lg border border-red-700 bg-red-600 px-4 py-3 text-white"
                  : "rounded-lg border state-warning-soft border-status-warning-soft-border px-4 py-3"}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${hasActiveAlarm ? "text-white" : "text-status-warning-soft-foreground"}`} />
                    <div>
                      <p className={`typo-label uppercase ${hasActiveAlarm ? "text-white" : "text-status-warning-soft-foreground"}`}>
                        {hasActiveAlarm ? "Sistema em Alarme" : "Sistema em Falha"}
                      </p>
                      <p className={`typo-body font-semibold ${hasActiveAlarm ? "text-white" : "text-status-warning-soft-foreground"}`}>
                        {buildEventAddress(displayedFailure)} - {normalizeLabel(displayedFailure.zoneName || displayedFailure.deviceName)}
                      </p>
                      <p className={`typo-caption ${hasActiveAlarm ? "text-white/95" : "text-status-warning-soft-foreground"}`}>
                        {EVENT_TYPE_LABEL[displayedFailure.type]}
                        {getDeviceTypeLabel(displayedFailure) !== "--" ? ` | Tipo: ${getDeviceTypeLabel(displayedFailure)}` : ""}
                      </p>
                      <p className={`typo-caption ${hasActiveAlarm ? "text-white/95" : "text-status-warning-soft-foreground"}`}>
                        Zona: {normalizeLabel(displayedFailure.zoneName)} | Dispositivo: {normalizeLabel(displayedFailure.deviceName)}
                      </p>
                      <p className={`typo-caption ${hasActiveAlarm ? "text-white/95" : "text-status-warning-soft-foreground"}`}>
                        Laço/Endereço: {buildEventAddress(displayedFailure)} | Data/Hora: {formatDate(displayedFailure.occurredAt)} {formatTime(displayedFailure.occurredAt)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border state-success-soft border-status-success-solid/40 px-4 py-3">
                  <p className="typo-label uppercase text-status-success-solid">Sistema Normal</p>
                  <p className="typo-body font-semibold text-status-success-soft-foreground">Nenhuma falha ativa registrada.</p>
                  <p className="typo-caption text-status-success-soft-foreground">A central está operando normalmente.</p>
                </div>
              )}

              <div>
                <p className="mb-2 typo-caption uppercase text-muted-foreground">Estado Atual</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {COUNTER_KEYS.map((item) => {
                    const active = currentStateTab === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => {
                          setCurrentStateTab(item.key);
                          setSecondaryMode("estado-atual");
                        }}
                        className={active
                          ? "rounded-lg border state-warning-soft px-3 py-2 text-center transition-colors"
                          : "rounded-lg border bg-muted/40 px-3 py-2 text-center transition-colors hover:bg-muted/60"}
                      >
                        <p className="typo-stat-value">{counters?.[item.key] ?? 0}</p>
                        <p className="typo-caption uppercase">{item.label}</p>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 typo-caption text-muted-foreground">
                  {selectedStateLabel}: {selectedStateCount} evento(s) ativo(s) no momento.
                </p>
              </div>

              <div>
                <p className="mb-2 typo-caption uppercase text-muted-foreground">Registro de Eventos</p>
                <Tabs
                  value={logTab}
                  onValueChange={(value) => {
                    setLogTab(value as DashboardLogTab);
                    setSecondaryMode("registro-eventos");
                  }}
                >
                  <TabsList className="grid h-10 w-full grid-cols-4">
                    {LOG_TABS.map((tab) => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="w-full"
                        onClick={() => {
                          setSecondaryMode("registro-eventos");
                          setLogTab(tab.value);
                        }}
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-card p-3">
                  <p className="typo-caption uppercase text-muted-foreground">Modelo</p>
                  <p className="typo-body font-medium">{normalizeLabel(visiblePanel?.central?.modelo)}</p>
                  <p className="mt-2 typo-caption uppercase text-muted-foreground">IP</p>
                  <p className="typo-body font-medium">{normalizeLabel(visiblePanel?.central?.ip)}</p>
                  <p className="mt-2 typo-caption uppercase text-muted-foreground">MAC</p>
                  <p className="typo-body font-medium">{normalizeLabel(visiblePanel?.central?.mac)}</p>
                </div>
                <div className="rounded-lg border bg-card p-3">
                  <p className="typo-caption uppercase text-muted-foreground">Data</p>
                  <p className="typo-body font-medium">{formatPanelDate(visiblePanel?.dataHora?.timestamp)}</p>
                  <p className="mt-2 typo-caption uppercase text-muted-foreground">Hora</p>
                  <p className="typo-body font-medium">{formatPanelTime(visiblePanel?.dataHora?.timestamp)}</p>
                  {visiblePanel?.lastError ? (
                    <>
                      <p className="mt-2 typo-caption uppercase text-muted-foreground">Último erro</p>
                      <p className="typo-caption text-status-danger-soft-foreground">{visiblePanel.lastError}</p>
                    </>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button
                  variant="outline"
                  disabled={commandMutation.isPending || offline || restarting}
                  onClick={() => void runCommand("silenceBip", "Silenciar Bip Interno")}
                  className={`h-11 ${ledCentralSilenciadaOn ? "border-primary text-primary bg-primary/10 hover:bg-primary/15" : ""}`}
                >
                  <VolumeX className="mr-2 h-4 w-4" />
                  Silenciar Bip
                </Button>
                <Button
                  variant="outline"
                  disabled={commandMutation.isPending || offline || restarting}
                  onClick={() => void runCommand(
                    ledSireneSilenciadaOn ? "releaseSiren" : "silenceSiren",
                    ledSireneSilenciadaOn ? "Reativar Sirene" : "Silenciar Sirene"
                  )}
                  className={`h-11 ${ledSireneSilenciadaOn ? "border-primary text-primary bg-primary/10 hover:bg-primary/15" : ""}`}
                >
                  <Bell className="mr-2 h-4 w-4" />{ledSireneSilenciadaOn ? "Reativar Sirene" : "Silenciar Sirene"}
                </Button>
                <Button
                  variant="destructive"
                  disabled={commandMutation.isPending || offline || restarting}
                  onClick={() => setConfirmAlarmOpen(true)}
                  className={`h-11 bg-red-600 text-white hover:bg-red-700 ${ledAlarmGeneralOn ? "ring-2 ring-red-300/70" : ""}`}
                >
                  <ShieldAlert className="mr-2 h-4 w-4" />
                  Disparar Alarme
                </Button>
                <Button
                  variant="outline"
                  disabled={commandMutation.isPending || offline || restarting}
                  onClick={() => void runCommand("restartCentral", "Reiniciar Central")}
                  className="h-11"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reiniciar
                </Button>
              </div>
              {ledCentralSilenciadaOn ? (
                <p className="typo-caption text-muted-foreground">
                  Bip interno silenciado. A reativação deve ser feita localmente na central (ou após reinício).
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="xl:col-span-2">
          <Card className="h-full min-h-[540px] shadow-sm">
            <CardHeader className="space-y-3">
              <CardTitle>{secondaryTitle}</CardTitle>
              <CardDescription>{secondaryDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[540px] overflow-y-auto pr-1">
                {secondaryMode === "estado-atual" ? (
                  selectedStateCount <= 0 ? (
                    <div className="rounded-lg border bg-muted p-4 typo-body text-muted-foreground">
                      Nenhum evento para ser apresentado.
                    </div>
                  ) : currentStateTab === "falha" && displayedFailure ? (
                    <button
                      type="button"
                      onClick={() => setSelectedDetail(displayedFailure)}
                      className="w-full rounded-lg border bg-muted/40 px-3 py-3 text-left transition-colors hover:bg-muted/60"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="typo-caption text-muted-foreground">1 - {buildEventAddress(displayedFailure)}</p>
                          <p className="typo-body font-semibold text-foreground">
                            {normalizeLabel(displayedFailure.zoneName || displayedFailure.deviceName)}
                          </p>
                          <p className="typo-caption text-muted-foreground">
                            Zona: {normalizeLabel(displayedFailure.zoneName)} | Dispositivo: {normalizeLabel(displayedFailure.deviceName)}
                          </p>
                          <p className="typo-caption text-muted-foreground">{EVENT_TYPE_LABEL[displayedFailure.type]}</p>
                        </div>
                        <div className="text-right">
                          <p className="typo-caption">{formatDate(displayedFailure.occurredAt)}</p>
                          <p className="typo-caption">{formatTime(displayedFailure.occurredAt)}</p>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="rounded-lg border bg-muted p-4 typo-body text-muted-foreground">
                      Nenhum evento para ser apresentado.
                    </div>
                  )
                ) : restarting ? (
                  <div className="rounded-lg border state-warning-soft px-4 py-3 typo-body text-status-warning-soft-foreground">
                    Central reiniciando. Registros serão exibidos após reconexão.
                  </div>
                ) : offline ? (
                  <div className="rounded-lg border state-danger-soft px-4 py-3 typo-body text-status-danger-soft-foreground">
                    Central offline. Registros indisponíveis no momento.
                  </div>
                ) : isLoading || waitingBatchLoad ? (
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
                      <button
                        key={event.key}
                        type="button"
                        onClick={() => setSelectedDetail(event)}
                        className="w-full rounded-lg border bg-muted/40 px-3 py-3 text-left transition-colors hover:bg-muted/60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="typo-caption text-muted-foreground">{index + 1} - {buildEventAddress(event)}</p>
                            <p className="typo-body font-semibold text-foreground">
                              {normalizeLabel(event.zoneName)}
                            </p>
                            <p className="typo-caption text-muted-foreground">
                              Zona: {normalizeLabel(event.zoneName)} | Dispositivo: {normalizeLabel(event.deviceName)}
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
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isLogsMode && logsErrorMessage ? (
                <div className="mt-3 rounded-lg border state-danger-soft px-4 py-3 typo-caption">
                  {logsErrorMessage}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={Boolean(selectedDetail)} onOpenChange={(open) => { if (!open) setSelectedDetail(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do evento</DialogTitle>
            <DialogDescription>
              {selectedDetail
                ? `${buildEventAddress(selectedDetail)} - ${normalizeLabel(selectedDetail.zoneName || selectedDetail.deviceName)}`
                : "Selecione uma linha para ver os detalhes."}
            </DialogDescription>
          </DialogHeader>
          {selectedDetail ? (
            <div className="grid gap-2 text-sm">
              <p><strong>Tipo:</strong> {EVENT_TYPE_LABEL[selectedDetail.type]}</p>
              <p><strong>ID:</strong> {selectedDetail.id}</p>
              <p><strong>Laço/Endereço:</strong> {buildEventAddress(selectedDetail)}</p>
              <p><strong>Zona:</strong> {normalizeLabel(selectedDetail.zoneName)}</p>
              <p><strong>Dispositivo:</strong> {normalizeLabel(selectedDetail.deviceName)}</p>
              <p><strong>Tipo do dispositivo:</strong> {getDeviceTypeLabel(selectedDetail)}</p>
              <p><strong>Data:</strong> {formatDate(selectedDetail.occurredAt)}</p>
              <p><strong>Hora:</strong> {formatTime(selectedDetail.occurredAt)}</p>
              <p><strong>Evento (código):</strong> {selectedDetail.eventType ?? "--"}</p>
              <p><strong>Bloqueado:</strong> {selectedDetail.blocked ? "Sim" : "Não"}</p>
              <div className="mt-2 rounded-md bg-muted p-3">
                <p className="mb-1 typo-caption text-muted-foreground">Payload bruto</p>
                <pre className="max-h-56 max-w-full overflow-auto whitespace-pre-wrap break-all text-xs">
                  {JSON.stringify(selectedDetail.raw, null, 2)}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmAlarmOpen} onOpenChange={setConfirmAlarmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar disparo de alarme</DialogTitle>
            <DialogDescription>
              Esta ação dispara o alarme geral da central de incêndio. Confirma o envio do comando?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmAlarmOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                setConfirmAlarmOpen(false);
                void runCommand("alarmGeneral", "Disparar Alarme");
              }}
              disabled={commandMutation.isPending || offline || restarting}
            >
              Confirmar disparo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

