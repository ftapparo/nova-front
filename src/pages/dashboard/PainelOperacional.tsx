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
import { notify } from "@/lib/notify";
import { useDashboard } from "@/contexts/DashboardContext";

type FailureItem = {
  kind: "Porta" | "Portao" | "Exaustor";
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

export default function PainelOperacional() {
  const {
    doors,
    gates,
    exhaustDevices,
    latestGateAccesses,
    latestAccessAutoRefresh,
    setLatestAccessAutoRefresh,
    lastAction,
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

  useEffect(() => {
    if (!refreshing) setHasLoadedInitialData(true);
  }, [refreshing]);

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
      kind: "Portao" as const,
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
        setShortcuts(parsed.filter((s) => s && typeof s.id === "string"));
      }
    } catch {
      setShortcuts([]);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts));
  }, [shortcuts]);

  const resetDialog = () => {
    setShortcutLabel("");
    setShortcutType("gate");
    setShortcutTargetId("");
    setShortcutAutoClose(15);
  };

  const saveShortcut = () => {
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

    setShortcuts((prev) => [next, ...prev].slice(0, 12));
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-white shadow-sm">
          <CardContent className="flex min-h-[131px] items-center justify-between p-5">
            <div>
              <CardTitle className="text-base font-semibold text-slate-700">Portas</CardTitle>
              <div className="mt-3 text-6xl font-extrabold leading-none tracking-tight text-slate-900">
                {initialLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : `${activeDoors}/${doors.length}`}
              </div>
              <p className="mt-3 text-xs text-slate-500">portas online agora</p>
            </div>
            <DoorOpen className="h-[77px] w-[77px] text-emerald-600" />
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardContent className="flex min-h-[131px] items-center justify-between p-5">
            <div>
              <CardTitle className="text-base font-semibold text-slate-700">Portoes</CardTitle>
              <div className="mt-3 text-6xl font-extrabold leading-none tracking-tight text-slate-900">
                {initialLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : `${activeGates}/${gates.length}`}
              </div>
              <p className="mt-3 text-xs text-slate-500">portoes online agora</p>
            </div>
            <Warehouse className="h-[77px] w-[77px] text-sky-600" />
          </CardContent>
        </Card>

        <Card className="bg-white shadow-sm">
          <CardContent className="flex min-h-[131px] items-center justify-between p-5">
            <div>
              <CardTitle className="text-base font-semibold text-slate-700">Exaustores</CardTitle>
              <div className="mt-3 text-6xl font-extrabold leading-none tracking-tight text-slate-900">
                {initialLoading ? <Loader2 className="h-10 w-10 animate-spin" /> : `${activeExhaustDevices}/${exhaustDevices.length}`}
              </div>
              <p className="mt-3 text-xs text-slate-500">exaustores online agora</p>
            </div>
            <Fan className="h-[77px] w-[77px] text-violet-600" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,5fr)]">
        <Card className="min-w-0 xl:col-span-1 h-[357px] flex flex-col">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Dispositivos em Falha</CardTitle>
            <CardDescription className="text-xs">Log rapido de equipamentos offline, com HTTP diferente de 200 ou com erro.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto">
            {initialLoading ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando falhas...
                </div>
              </div>
            ) : failures.length === 0 ? (
              <div className="rounded-lg border bg-emerald-50 p-4 text-sm text-emerald-700">Nenhuma falha no momento.</div>
            ) : (
              <div className="space-y-3">
                {failures.map((item, index) => (
                  <div key={`${item.kind}-${item.name}-${index}`} className="rounded-lg bg-rose-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{item.kind}: {item.name}</p>
                        <p className="text-xs text-slate-500">IP {item.ip} - Porta {item.port ?? "--"} - HTTP {item.statusCode ?? "--"}</p>
                      </div>
                      <Badge className="rounded-full bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-rose-600" />
                        Falha
                      </Badge>
                    </div>
                    {item.error ? <p className="mt-2 text-xs text-rose-700">Erro: {item.error}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 xl:col-span-1 h-[357px] flex flex-col pb-[42px]">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold">Ultimos Acessos</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Auto</span>
                <Switch
                  checked={latestAccessAutoRefresh}
                  onCheckedChange={setLatestAccessAutoRefresh}
                  aria-label="Atualizacao automatica de ultimos acessos"
                />
              </div>
            </div>
            <CardDescription className="text-xs">Ultimos acessos dos portoes (ate 20 itens) via access/list.</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pl-6 pr-4" onScroll={handleLatestAccessesScroll}>
            {initialLoading ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando últimos acessos...
                </div>
              </div>
            ) : latestGateAccesses.length === 0 ? (
              <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
                Sem acessos recentes para exibir.
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                {latestGateAccesses.map((access, index) => {
                  const isExit = isExitAccess(access.sentido);
                  return (
                    <div key={`${access.gateId}-${access.tag}-${access.validatedAt}-${index}`} className="flex w-full items-center overflow-hidden rounded-md bg-slate-100 px-3 py-2 text-slate-900">
                      <span className="mr-2 inline-flex shrink-0 align-middle">
                        {isExit ? (
                          <LogOut className="h-[18px] w-[18px] text-rose-600" />
                        ) : (
                          <LogIn className="h-[18px] w-[18px] text-emerald-600" />
                        )}
                      </span>
                    <span className="block min-w-0 truncate whitespace-nowrap">
                      {access.tag} - {access.nome} - {access.descricao} - {access.quadra} {access.lote} - {formatApiDateTimeNoTimezone(access.validatedAt)}
                    </span>
                  </div>
                );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Acessos Rapidos</h2>
          <p className="text-xs text-muted-foreground">Atalhos para abrir porta ou portao com 1 clique.</p>
        </div>
        <div className="flex flex-wrap gap-5">
          {shortcuts.map((shortcut) => {
            const isRunning = runningShortcutId === shortcut.id;
            const ShortcutIcon = shortcut.type === "door" ? DoorOpen : Warehouse;
            return (
              <div key={shortcut.id} className="relative h-[106px] w-[210px] rounded-xl border bg-white p-2">
                <button
                  type="button"
                  onClick={() => void runShortcut(shortcut)}
                  disabled={isRunning}
                  className="flex h-full w-full items-center justify-between rounded-lg px-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-60"
                >
                  <div className="pr-6">
                    <div className="text-sm font-semibold leading-tight text-slate-800">{shortcut.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{shortcut.type === "door" ? "Porta" : `Portao ${shortcut.autoClose}s`}</div>
                  </div>
                  <ShortcutIcon className="h-7 w-7 shrink-0 text-slate-700" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Acoes do atalho"
                    >
                      <EllipsisVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => removeShortcut(shortcut.id)}
                      className="cursor-pointer text-rose-600 hover:bg-rose-50 hover:text-rose-700 focus:bg-rose-50 focus:text-rose-700"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="flex h-[106px] w-[210px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-sky-300/45 bg-sky-50/35 text-sky-600/55 transition-colors hover:border-sky-300/60 hover:bg-sky-100/45 hover:text-sky-600/70"
          >
            <Plus className="mb-2 h-8 w-8" />
            <span className="text-xs font-medium">Adicionar</span>
          </button>
        </div>
      </div>

      {lastAction && (
        <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
          <div>
            <p className="text-sm font-medium text-sky-800">Ultima operacao</p>
            <p className="text-sm text-sky-700">{lastAction}</p>
          </div>
        </div>
      )}

      {apiError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-destructive">Erro</p>
            <p className="text-sm text-destructive/80">{apiError}</p>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetDialog();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo atalho rapido</DialogTitle>
            <DialogDescription>Crie um acesso de 1 clique para porta ou portao.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome do atalho</Label>
              <Input value={shortcutLabel} onChange={(e) => setShortcutLabel(e.target.value)} placeholder="Ex: Portao Veiculos" className="h-9 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={shortcutType} onValueChange={(value) => {
                setShortcutType(value as ShortcutType);
                setShortcutTargetId("");
              }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="door">Porta</SelectItem>
                  <SelectItem value="gate">Portao</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Dispositivo</Label>
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
                <Label className="text-xs">Fechamento automatico (s)</Label>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
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
              <Label className="text-xs">CPF</Label>
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
                  variant="outline"
                  onClick={() => void verifyGateCpf()}
                  disabled={sanitizeDigits(gateCpf).length < 11 || gateVerifyLoading}
                  className="h-9 px-3"
                >
                  {gateVerifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div
              className={`min-h-[120px] rounded-md border px-3 py-2 text-sm ${
                !gateVerifyMessage && !gateVerifiedPerson
                  ? "border-slate-200 bg-slate-100 text-slate-700"
                  : gateAllowed
                    ? "border-emerald-200 bg-emerald-100 text-emerald-900"
                    : "border-rose-200 bg-rose-100 text-rose-900"
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
                <p className="pt-2 text-xs">Insira um CPF e clique na lupa para validar o acesso.</p>
              )}

              {gateVerifyMessage ? (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {gateAllowed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <span>{gateVerifyMessage}</span>
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGateAuthModalOpen(false)} disabled={gateOpenLoading}>Cancelar</Button>
            <Button onClick={() => void confirmGateShortcutOpen()} disabled={!gateAllowed || !gateVerifiedPerson || gateVerifyLoading || gateOpenLoading}>
              {gateOpenLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Abrir o portão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
