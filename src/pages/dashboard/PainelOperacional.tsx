import { useEffect, useMemo, useRef, useState, type UIEventHandler } from "react";
import { DoorOpen, Warehouse, Fan, AlertTriangle, Info, Plus, EllipsisVertical, Trash2, LogIn, LogOut, Loader2, Search, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { api, type AccessVerifyItem } from "@/services/api";
import { getCommandLogCardSubtitle, getCommandLogCardTitle } from "@/lib/command-log-presenter";
import { notify } from "@/lib/notify";
import { useDashboard, type LatestGateAccessItem } from "@/contexts/DashboardContext";
import { useAuth } from "@/contexts/AuthContext";
import { queueUserSettingsPush } from "@/services/user-settings-sync";
import PageContainer from "@/components/layout/PageContainer";

type FailureItem = {
  kind: "Porta" | "Portão" | "Exaustor";
  name: string;
  ip: string;
  port: number | null;
  statusCode: number | null;
  error: string | null;
  online: boolean;
};

type ShortcutType = "door" | "gate";

type QuickShortcut = {
  id: string;

  label: string;
  type: ShortcutType;
  targetId: string;
  autoClose: number;
};

const SHORTCUTS_STORAGE_KEY = "nr.quick-access.v1";
const WIDE_VIEWPORT_MIN_WIDTH = 1560;
const MOBILE_VIEWPORT_MAX_WIDTH = 639;
const MAX_QUICK_SHORTCUTS = 6;

const isExitAccess = (direction: string): boolean => {
  const normalized = (direction || "").trim().toUpperCase();
  return normalized === "S";
};

const formatApiDateTimeNoTimezone = (value: string): string => {
  if (!value) return "--";
  const [datePart = "", timePart = ""] = value.split("T");
  const [year = "", month = "", day = ""] = datePart.split("-");
  const time = timePart.slice(0, 8);
  if (!year || !month || !day || !time) return value;
  return `${day}/${month}/${year}, ${time}`;
};

const truncateResidentName = (name: string, maxLength = 25): string => {
  const normalized = (name || "").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength)}...`;
};

export default function PainelOperacional() {
  const { user } = useAuth();
  const {
    doors,
    gates,
    exhaustDevices,
    latestGateAccesses,
    latestAccessAutoRefresh,
    setLatestAccessAutoRefresh,
    lastAction,
    commandHistory,
    refreshCommandHistory,
    apiError,
    refreshing,
    handleOpenDoor,
    handleOpenGate,
  } = useDashboard();

  const [shortcuts, setShortcuts] = useState<QuickShortcut[]>([]);
  const [runningShortcutId, setRunningShortcutId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [shortcutLabel, setShortcutLabel] = useState("");
  const [shortcutType, setShortcutType] = useState<ShortcutType>("gate");
  const [shortcutTargetId, setShortcutTargetId] = useState("");
  const [shortcutAutoClose, setShortcutAutoClose] = useState(15);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const latestAccessAutoResumeTimerRef = useRef<number | null>(null);
  const [gateAuthModalOpen, setGateAuthModalOpen] = useState(false);
  const [pendingGateShortcut, setPendingGateShortcut] = useState<QuickShortcut | null>(null);
  const [gateCpf, setGateCpf] = useState("");
  const [gateVerifyLoading, setGateVerifyLoading] = useState(false);
  const [gateOpenLoading, setGateOpenLoading] = useState(false);
  const [gateVerifiedPerson, setGateVerifiedPerson] = useState<AccessVerifyItem | null>(null);
  const [gateVerifyMessage, setGateVerifyMessage] = useState<string | null>(null);
  const [gateAllowed, setGateAllowed] = useState(false);
  const [failuresDialogOpen, setFailuresDialogOpen] = useState(false);
  const [isWideViewport, setIsWideViewport] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [selectedLatestAccess, setSelectedLatestAccess] = useState<LatestGateAccessItem | null>(null);
  const [commandHistoryModalOpen, setCommandHistoryModalOpen] = useState(false);

  useEffect(() => {
    if (!refreshing) setHasLoadedInitialData(true);
  }, [refreshing]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const evaluateViewport = () => {
      setIsWideViewport(window.innerWidth >= WIDE_VIEWPORT_MIN_WIDTH);
      setIsMobileViewport(window.innerWidth <= MOBILE_VIEWPORT_MAX_WIDTH);
    };

    evaluateViewport();
    window.addEventListener("resize", evaluateViewport);
    return () => window.removeEventListener("resize", evaluateViewport);
  }, []);

  const activeDoors = doors.filter((d) => d.online).length;
  const activeGates = gates.filter((g) => g.online).length;
  const activeExhaustDevices = exhaustDevices.filter((d) => d.online).length;

  const failures: FailureItem[] = [
    ...doors.map((d) => ({
      kind: "Porta" as const,
      name: d.nome,
      ip: d.ip || "--",
      port: d.porta ?? null,
      statusCode: d.statusCode,
      error: d.error,
      online: d.online,
    })),
    ...gates.map((g) => ({
      kind: "Portão" as const,
      name: g.nome,
      ip: g.ip || "--",
      port: g.porta ?? null,
      statusCode: g.statusCode,
      error: g.error,
      online: g.online,
    })),
    ...exhaustDevices.map((e) => ({
      kind: "Exaustor" as const,
      name: e.nome || e.id,
      ip: e.host || "--",
      port: e.port ?? null,
      statusCode: e.statusCode,
      error: e.error,
      online: e.online,
    })),
  ].filter((item) => {
    if (!item.online) return true;
    if (item.statusCode === null) return false;
    return item.statusCode !== 200 || Boolean(item.error);
  });
  const failureCount = failures.length;

  const doorOptions = useMemo(
    () => doors.map((d) => ({ id: String(d.id), name: d.nome })),
    [doors],
  );

  const gateOptions = useMemo(
    () => gates.map((g) => ({ id: String(g.numeroDispositivo), name: g.nome })),
    [gates],
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(SHORTCUTS_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as QuickShortcut[];
      if (Array.isArray(parsed)) {
        setShortcuts(parsed.filter((s) => s && typeof s.id === "string").slice(0, MAX_QUICK_SHORTCUTS));
      }
    } catch {
      setShortcuts([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
    if (user) {
      queueUserSettingsPush(user);
    }
  }, [shortcuts, user]);

  const resetDialog = () => {
    setShortcutLabel("");
    setShortcutType("gate");
    setShortcutTargetId("");
    setShortcutAutoClose(15);
  };

  const saveShortcut = () => {
    if (shortcuts.length >= MAX_QUICK_SHORTCUTS) return;
    const label = shortcutLabel.trim();
    if (!label || !shortcutTargetId) return;
    const autoClose = Number.isFinite(shortcutAutoClose) && shortcutAutoClose > 0 ? shortcutAutoClose : 15;

    const next: QuickShortcut = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label,
      type: shortcutType,
      targetId: shortcutTargetId,
      autoClose,
    };

    setShortcuts((prev) => [next, ...prev].slice(0, MAX_QUICK_SHORTCUTS));
    setDialogOpen(false);
    resetDialog();
  };

  const runShortcut = async (shortcut: QuickShortcut) => {
    if (shortcut.type === "door") {
      setRunningShortcutId(shortcut.id);
      try {
        await handleOpenDoor(shortcut.targetId);
      } finally {
        setRunningShortcutId(null);
      }
      return;
    }

    setPendingGateShortcut(shortcut);
    setGateCpf("");
    setGateVerifiedPerson(null);
    setGateVerifyMessage(null);
    setGateAllowed(false);
    setGateAuthModalOpen(true);
  };

  const removeShortcut = (id: string) => {
    setShortcuts((prev) => prev.filter((s) => s.id !== id));
  };

  const sanitizeDigits = (value: string) => value.replace(/\D/g, "");
  const normalizeNumber = (value: unknown): number => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };
  const normalizeChar = (value: unknown): string => {
    const text = String(value ?? "").trim();
    return text ? text[0] : "0";
  };
  const normalizeText = (value: unknown): string => {
    const text = String(value ?? "").trim();
    return text || "0";
  };

  const resetGateShortcutFlow = () => {
    setPendingGateShortcut(null);
    setGateCpf("");
    setGateVerifyLoading(false);
    setGateOpenLoading(false);
    setGateVerifiedPerson(null);
    setGateVerifyMessage(null);
    setGateAllowed(false);
  };

  const verifyGateCpf = async () => {
    const cpfDigits = sanitizeDigits(gateCpf);
    const deviceId = pendingGateShortcut ? Number(pendingGateShortcut.targetId) : 0;

    if (!deviceId || cpfDigits.length < 11) {
      setGateVerifyMessage("Informe um CPF válido para validar o acesso.");
      setGateVerifiedPerson(null);
      setGateAllowed(false);
      return;
    }

    setGateVerifyLoading(true);
    setGateVerifyMessage(null);
    try {
      const response = await api.accessVerify(cpfDigits, deviceId, "E");
      const person = response?.[0] ?? null;
      if (!person) {
        setGateVerifyMessage("Nenhum cadastro encontrado para este CPF.");
        setGateVerifiedPerson(null);
        setGateAllowed(false);
        return;
      }

      const permitido = (person.PERMITIDO || "").trim().toUpperCase() === "S";
      const perfilValido = ["PROP", "LOC", "MOR"].some((key) => (person[key as "PROP" | "LOC" | "MOR"] || "").trim().toUpperCase() === "S");
      const allowed = permitido && perfilValido;

      setGateVerifiedPerson(person);
      setGateAllowed(allowed);
      setGateVerifyMessage(allowed ? "Acesso liberado para abertura do portão." : "Acesso não autorizado para abertura do portão.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao validar CPF.";
      setGateVerifyMessage(message);
      setGateVerifiedPerson(null);
      setGateAllowed(false);
    } finally {
      setGateVerifyLoading(false);
    }
  };

  const confirmGateShortcutOpen = async () => {
    if (!pendingGateShortcut || !gateAllowed || !gateVerifiedPerson) return;

    setGateOpenLoading(true);
    try {
      await handleOpenGate(pendingGateShortcut.targetId, pendingGateShortcut.autoClose || 15);
      try {
        await api.accessRegister({
          dispositivo: Number(pendingGateShortcut.targetId),
          pessoa: normalizeNumber(gateVerifiedPerson.SEQPESSOA),
          classificacao: normalizeNumber(gateVerifiedPerson.SEQCLASSIFICACAO),
          classAutorizado: normalizeChar(gateVerifiedPerson.CLASSIFAUTORIZADA),
          autorizacaoLanc: normalizeChar(gateVerifiedPerson.AUTORIZACAOLANC),
          origem: normalizeChar(gateVerifiedPerson.TIPO),
          seqIdAcesso: normalizeNumber(gateVerifiedPerson.SEQIDACESSO),
          sentido: "E",
          quadra: normalizeText(gateVerifiedPerson.QUADRA),
          lote: normalizeText(gateVerifiedPerson.LOTE),
          panico: normalizeChar(gateVerifiedPerson.PANICO),
          formaAcesso: "TAG",
          idAcesso: normalizeText(gateVerifiedPerson.IDENT),
          seqVeiculo: normalizeNumber(gateVerifiedPerson.SEQVEICULO),
        });
        notify.success("Acesso registrado", { description: "Registro de entrada realizado com sucesso." });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao registrar acesso.";
        notify.error("Falha no registro de acesso", { description: message });
      }

      setGateAuthModalOpen(false);
      resetGateShortcutFlow();
    } finally {
      setGateOpenLoading(false);
    }
  };

  useEffect(() => {
    setLatestAccessAutoRefresh(true);
  }, [setLatestAccessAutoRefresh]);

  const clearLatestAccessAutoResumeTimer = () => {
    if (latestAccessAutoResumeTimerRef.current !== null) {
      window.clearTimeout(latestAccessAutoResumeTimerRef.current);
      latestAccessAutoResumeTimerRef.current = null;
    }
  };

  const handleLatestAccessesScroll: UIEventHandler<HTMLDivElement> = (event) => {
    const isAtTop = event.currentTarget.scrollTop <= 2;

    if (!isAtTop) {
      clearLatestAccessAutoResumeTimer();
      if (latestAccessAutoRefresh) {
        setLatestAccessAutoRefresh(false);
      }
      return;
    }

    if (!latestAccessAutoRefresh && latestAccessAutoResumeTimerRef.current === null) {
      latestAccessAutoResumeTimerRef.current = window.setTimeout(() => {
        setLatestAccessAutoRefresh(true);
        latestAccessAutoResumeTimerRef.current = null;
      }, 2000);
    }
  };

  useEffect(() => {
    return () => {
      clearLatestAccessAutoResumeTimer();
    };
  }, []);
  const initialLoading = !hasLoadedInitialData && refreshing;
  const autoRefreshSwitchId = "latest-access-auto-refresh";
  const lastActionMessage = lastAction ?? "Nenhuma operação recente.";
  const openCommandHistoryModal = () => {
    setCommandHistoryModalOpen(true);
    void refreshCommandHistory();
  };

  const handleOpenFailuresModal = () => {
    setFailuresDialogOpen(true);
  };

  const handleOpenLatestAccessDetails = (access: LatestGateAccessItem) => {
    if (!isMobileViewport) return;
    setSelectedLatestAccess(access);
  };

  return (
    <PageContainer size={isWideViewport ? "wide" : "default"} className="min-w-0">
      <h1 className="sr-only">Painel Operacional</h1>
      <button
        type="button"
        onClick={openCommandHistoryModal}
        className="flex w-full items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-left sm:hidden"
      >
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="typo-body font-medium text-primary">Última operação</p>
          <p className="typo-body text-primary">{lastActionMessage}</p>
        </div>
      </button>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="hidden bg-card shadow-sm sm:block">
          <CardContent className="flex min-h-[131px] items-center justify-between p-5">
            <div>
              <CardTitle>Portas</CardTitle>
              <div className="mt-3 typo-stat-value">
                {initialLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : `${activeDoors}/${doors.length}`}
              </div>
              <p className="mt-3 typo-caption">online agora</p>
            </div>
            <DoorOpen className="h-[77px] w-[77px] text-primary" />
          </CardContent>
        </Card>

        <Card className="hidden bg-card shadow-sm sm:block">
          <CardContent className="flex min-h-[131px] items-center justify-between p-5">
            <div>
              <CardTitle>Portões</CardTitle>
              <div className="mt-3 typo-stat-value">
                {initialLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : `${activeGates}/${gates.length}`}
              </div>
              <p className="mt-3 typo-caption">online agora</p>
            </div>
            <Warehouse className="h-[77px] w-[77px] text-primary" />
          </CardContent>
        </Card>

        <Card className="hidden bg-card shadow-sm sm:block">
          <CardContent className="flex min-h-[131px] items-center justify-between p-5">
            <div>
              <CardTitle>Exaustores</CardTitle>
              <div className="mt-3 typo-stat-value">
                {initialLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : `${activeExhaustDevices}/${exhaustDevices.length}`}
              </div>
              <p className="mt-3 typo-caption">online agora</p>
            </div>
            <Fan className="h-[77px] w-[77px] text-primary" />
          </CardContent>
        </Card>

        <Card
          className="bg-card shadow-sm transition cursor-pointer hover:border-primary/30"
          onClick={handleOpenFailuresModal}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleOpenFailuresModal();
            }
          }}
        >
          <CardContent className="flex min-h-[131px] items-center justify-between p-5">
            <div>
              <CardTitle>Falhas</CardTitle>
              <div className="mt-3 typo-stat-value">
                {initialLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : failureCount}
              </div>
              <p className="mt-3 typo-caption">dispositivos</p>
            </div>
            <AlertTriangle className="h-[77px] w-[77px] text-destructive" />
          </CardContent>
        </Card>
      </div>
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row">
        <Card className="order-2 flex min-h-0 max-h-[458px] min-w-0 flex-1 flex-col overflow-hidden pb-[20px] sm:h-[400px] sm:max-h-[400px] xl:order-1">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Últimos Acessos</CardTitle>
              <div className="flex items-center gap-2">
                <span className="typo-caption">Auto</span>
                <Switch
                  id={autoRefreshSwitchId}
                  checked={latestAccessAutoRefresh}
                  onCheckedChange={setLatestAccessAutoRefresh}
                  aria-label="Ativar atualização automática dos últimos acessos"
                />
              </div>
            </div>
            <CardDescription>Últimos acessos dos portões veiculares.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto" onScroll={handleLatestAccessesScroll}>
            {initialLoading ? (
              <div className="rounded-lg border border-border bg-muted p-4">
                <div className="flex items-center justify-center gap-2 typo-body text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando últimos acessos...
                </div>
              </div>
            ) : latestGateAccesses.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted p-4 typo-body text-muted-foreground">
                Sem acessos recentes para exibir.
              </div>
            ) : (
              <div className="space-y-2 font-mono">
                {latestGateAccesses.map((access, index) => {
                  const isExit = isExitAccess(access.sentido);
                  const formattedDate = formatApiDateTimeNoTimezone(access.validatedAt);
                  const residentName = truncateResidentName(access.nome, 25);
                  const locationSummary = `${access.quadra} ${access.lote}`;
                  const accessSummary = `${access.tag} — ${residentName} • ${access.descricao} • ${locationSummary} • ${formattedDate}`;
                  const mobilePrimaryLine = `${access.tag} — ${residentName}`;
                  const compactPrimaryLine = `${access.tag} — ${residentName} • ${locationSummary}`;
                  const compactSecondaryLine = `${access.descricao} • ${formattedDate}`;
                  const accessRowContent = (
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex rounded-full bg-background/80 p-1 ${isExit ? "text-status-danger-soft-foreground" : "text-status-success-soft-foreground"}`}>
                        {isExit ? (
                          <LogOut className="h-4 w-4" />
                        ) : (
                          <LogIn className="h-4 w-4" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1" title={accessSummary}>
                        {isMobileViewport ? (
                          <p className="truncate text-[12px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{mobilePrimaryLine}</p>
                        ) : isWideViewport ? (
                          <p className="truncate text-[12.5px] font-semibold leading-snug tracking-[-0.02em]">{accessSummary}</p>
                        ) : (
                          <>
                            <p className="truncate text-[12px] font-semibold leading-tight tracking-[-0.02em] text-foreground">{compactPrimaryLine}</p>
                            <p className="truncate text-[11.5px] font-medium leading-tight tracking-[-0.015em]">{compactSecondaryLine}</p>
                          </>
                        )}
                      </div>
                    </div>
                  );

                  return isMobileViewport ? (
                    <button
                      key={`${access.gateId}-${access.tag}-${access.validatedAt}-${index}`}
                      type="button"
                      onClick={() => handleOpenLatestAccessDetails(access)}
                      className="w-full cursor-pointer rounded-lg border border-border/60 bg-muted/50 p-3 text-left hover:bg-muted/80"
                    >
                      {accessRowContent}
                    </button>
                  ) : (
                    <div
                      key={`${access.gateId}-${access.tag}-${access.validatedAt}-${index}`}
                      className="rounded-lg border border-border/60 bg-muted/50 p-3"
                    >
                      {accessRowContent}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="order-1 min-w-0 w-full space-y-2 xl:order-2 xl:max-w-[460px] xl:shrink-0">
          <div>
            <h2 className="typo-section-title">Acessos Rápidos</h2>
            <p className="typo-caption">Comandos de abertura rápida de portas e portões.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 py-2">
            {shortcuts.map((shortcut) => {
              const isRunning = runningShortcutId === shortcut.id;
              const ShortcutIcon = shortcut.type === "door" ? DoorOpen : Warehouse;
              return (
                <div key={shortcut.id} className="relative h-[104px] rounded-xl border bg-card">
                  <button
                    type="button"
                    onClick={() => void runShortcut(shortcut)}
                    disabled={isRunning}
                    className="flex h-full w-full items-center justify-between rounded-lg px-3 text-left transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    <div className="pr-6">
                      <div className="typo-body font-semibold leading-tight">{shortcut.label}</div>
                      <div className="mt-1 typo-caption">{shortcut.type === "door" ? "Porta" : `Portão ${shortcut.autoClose}s`}</div>
                    </div>
                    <ShortcutIcon className="h-7 w-7 shrink-0 text-foreground" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Acoes do atalho"
                      >
                        <EllipsisVertical className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => removeShortcut(shortcut.id)}
                        className="cursor-pointer text-status-danger-solid hover:bg-status-danger-soft hover:text-status-danger-soft-foreground focus:bg-status-danger-soft focus:text-status-danger-soft-foreground"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}

            {shortcuts.length < MAX_QUICK_SHORTCUTS ? (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="flex h-[104px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-primary/35 bg-primary/10 text-primary/55 transition-colors hover:border-primary/55 hover:bg-primary/15 hover:text-primary/80"
              >
                <Plus className="mb-2 h-8 w-8" />
                <span className="typo-label">Adicionar</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={openCommandHistoryModal}
        className="hidden w-full items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-left sm:flex"
      >
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="typo-body font-medium text-primary">Última operação</p>
          <p className="typo-body text-primary">{lastActionMessage}</p>
        </div>
      </button>

      {apiError && (
        <div className="state-danger-soft flex items-start gap-3 rounded-lg border p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-current" />
          <div>
            <p className="typo-body font-medium text-current">Erro</p>
            <p className="typo-body text-current/90">{apiError}</p>
          </div>
        </div>
      )}

      <Dialog open={failuresDialogOpen} onOpenChange={setFailuresDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dispositivos em Falha</DialogTitle>
            <DialogDescription>
              {failureCount > 0 ? "Lista atualizada de dispositivos offline ou com erro." : "Nenhuma falha registrada neste momento."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[420px] overflow-y-auto pr-1">
            {initialLoading ? (
              <div className="rounded-lg border border-border bg-muted p-4">
                <div className="flex items-center justify-center gap-2 typo-body text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando falhas...
                </div>
              </div>
            ) : failureCount === 0 ? (
              <div className="rounded-lg border border-border bg-muted p-4 typo-body text-muted-foreground">Nenhuma falha no momento.</div>
            ) : (
              <div className="space-y-3">
                {failures.map((item, index) => (
                  <div key={`${item.kind}-${item.name}-${index}`} className="state-danger-soft rounded-lg border px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="typo-body font-semibold text-foreground">{item.kind}: {item.name}</p>
                        <p className="typo-caption">IP {item.ip} - Porta {item.port ?? "--"} - HTTP {item.statusCode ?? "--"}</p>
                      </div>
                      <Badge className="rounded-full state-danger-soft px-3 py-1 typo-caption font-medium">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-status-danger-solid" />
                        Falha
                      </Badge>
                    </div>
                    {item.error ? <p className="mt-2 typo-caption text-current">Erro: {item.error}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetDialog();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo atalho rápido</DialogTitle>
            <DialogDescription>Crie um acesso de 1 clique para porta ou portão.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="typo-label">Nome do atalho</Label>
              <Input value={shortcutLabel} onChange={(e) => setShortcutLabel(e.target.value)} placeholder="Ex: Portão Veículos" className="h-9 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="typo-label">Tipo</Label>
              <Select value={shortcutType} onValueChange={(value) => {
                setShortcutType(value as ShortcutType);
                setShortcutTargetId("");
              }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="door">Porta</SelectItem>
                  <SelectItem value="gate">Portão</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="typo-label">Dispositivo</Label>
              <Select value={shortcutTargetId} onValueChange={setShortcutTargetId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(shortcutType === "door" ? doorOptions : gateOptions).map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {shortcutType === "gate" ? (
              <div className="space-y-1">
                <Label className="typo-label">Fechamento automático (s)</Label>
                <Input
                  type="number"
                  min={1}
                  value={shortcutAutoClose}
                  onChange={(e) => setShortcutAutoClose(Number(e.target.value))}
                  className="h-9 text-sm"
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary active:bg-primary/20"
            >
              Cancelar
            </Button>
            <Button onClick={saveShortcut} disabled={!shortcutLabel.trim() || !shortcutTargetId}>Salvar atalho</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={gateAuthModalOpen}
        onOpenChange={(open) => {
          setGateAuthModalOpen(open);
          if (!open) resetGateShortcutFlow();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Validar CPF para abrir portão</DialogTitle>
            <DialogDescription>
              {pendingGateShortcut ? `Atalho: ${pendingGateShortcut.label}` : "Validação necessária para abertura."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="typo-label">CPF</Label>
              <div className="flex gap-2">
                <Input
                  value={gateCpf}
                  onChange={(e) => {
                    setGateCpf(e.target.value);
                    setGateVerifiedPerson(null);
                    setGateVerifyMessage(null);
                    setGateAllowed(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void verifyGateCpf();
                      return;
                    }
                    if (e.key === "Tab") {
                      void verifyGateCpf();
                    }
                  }}
                  inputMode="numeric"
                  placeholder="Digite o CPF"
                  className="h-9 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => void verifyGateCpf()}
                  disabled={sanitizeDigits(gateCpf).length < 11 || gateVerifyLoading}
                  className="h-9 px-3 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary active:bg-primary/20"
                >
                  {gateVerifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div
              className={`mt-2 min-h-[132px] rounded-md px-3 border  py-2 typo-body ${!gateVerifyMessage && !gateVerifiedPerson
                ? "border-border bg-muted text-muted-foreground"
                : gateAllowed
                  ? "state-success-soft border-status-success-solid/40"
                  : "state-danger-soft border-status-danger-solid/40"
                }`}
            >
              {gateVerifiedPerson ? (
                <>
                  <p className="font-medium">{gateVerifiedPerson.NOME?.trim() || "--"}</p>
                  <p>Unidade: {gateVerifiedPerson.QUADRA?.trim() || "--"} {gateVerifiedPerson.LOTE?.trim() || "--"}</p>
                  <p>Tipo: {gateVerifiedPerson.DESCRICAO?.trim() || "--"}</p>
                  <p>Permitido: {(gateVerifiedPerson.PERMITIDO || "").trim().toUpperCase() === "S" ? "Sim" : "Não"}</p>
                </>
              ) : (
                <p className="pt-2 typo-caption">Insira um CPF e clique na lupa para validar o acesso.</p>
              )}

              {gateVerifyMessage ? (
                <div className="mt-2 flex items-center gap-2 typo-caption text-current">
                  {gateAllowed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <span>{gateVerifyMessage}</span>
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setGateAuthModalOpen(false)}
              disabled={gateOpenLoading}
              className="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary active:bg-primary/20"
            >
              Cancelar
            </Button>
            <Button onClick={() => void confirmGateShortcutOpen()} disabled={!gateAllowed || !gateVerifiedPerson || gateVerifyLoading || gateOpenLoading}>
              {gateOpenLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Abrir o portão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedLatestAccess)} onOpenChange={(open) => { if (!open) setSelectedLatestAccess(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes do acesso</DialogTitle>
            <DialogDescription>
              {selectedLatestAccess ? `${selectedLatestAccess.tag} - ${selectedLatestAccess.nome}` : "Selecione um acesso."}
            </DialogDescription>
          </DialogHeader>

          {selectedLatestAccess ? (
            <div className="space-y-2 typo-body">
              <p><strong>Tag:</strong> {selectedLatestAccess.tag}</p>
              <p><strong>Morador:</strong> {selectedLatestAccess.nome}</p>
              <p><strong>Tipo:</strong> {selectedLatestAccess.descricao}</p>
              <p><strong>Unidade:</strong> {selectedLatestAccess.quadra} {selectedLatestAccess.lote}</p>
              <p><strong>Sentido:</strong> {isExitAccess(selectedLatestAccess.sentido) ? "Saída" : "Entrada"}</p>
              <p><strong>Data/Hora:</strong> {formatApiDateTimeNoTimezone(selectedLatestAccess.validatedAt)}</p>
              <p><strong>Portão:</strong> {selectedLatestAccess.gateName} ({selectedLatestAccess.gateId})</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={commandHistoryModalOpen} onOpenChange={setCommandHistoryModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Últimas ações do sistema</DialogTitle>
            <DialogDescription>Histórico das 20 ações mais recentes do painel.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[420px] overflow-y-auto rounded-md border border-border p-2">
            {commandHistory.length === 0 ? (
              <p className="typo-body text-muted-foreground p-2">Nenhum comando registrado.</p>
            ) : (
              <div className="space-y-2">
                {commandHistory.map((item) => (
                  <div key={item.id} className="rounded-md border border-border bg-muted/50 p-3">
                    <p className="typo-body font-medium text-foreground">{getCommandLogCardTitle(item)}</p>
                    <p className="typo-caption text-muted-foreground">{getCommandLogCardSubtitle(item)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
