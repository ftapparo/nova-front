import { useCallback, useEffect, useMemo, useState } from "react";
import { EllipsisVertical, Fan, Loader2, Power, PowerOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDashboard } from "@/contexts/DashboardContext";
import { api, type ExhaustModuleStatus, type ExhaustProcessMemoryItem } from "@/services/api";
import { humanizeLabel } from "@/lib/utils";

const BLOCKS = ["A", "B", "C"];
const DEFAULT_DURATION_MINUTES = 180;
const MIN_CUSTOM_DURATION_MINUTES = 30;

export default function Exaustores() {
  const { handleExhaustOn, handleExhaustOff } = useDashboard();

  const [block, setBlock] = useState("");
  const [apartment, setApartment] = useState("");
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customDuration, setCustomDuration] = useState(DEFAULT_DURATION_MINUTES);
  const [onLoading, setOnLoading] = useState(false);
  const [offLoadingId, setOffLoadingId] = useState<string | null>(null);
  const [exhaustToConfirmOff, setExhaustToConfirmOff] = useState<ExhaustProcessMemoryItem | null>(null);

  const [activeExhausts, setActiveExhausts] = useState<ExhaustProcessMemoryItem[]>([]);
  const [moduleStatuses, setModuleStatuses] = useState<Record<string, ExhaustModuleStatus>>({});
  const [processLoading, setProcessLoading] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  const hasValidCustomDuration = Number.isFinite(customDuration) && customDuration >= MIN_CUSTOM_DURATION_MINUTES;
  const effectiveDuration = useCustomDuration ? customDuration : DEFAULT_DURATION_MINUTES;
  const valid = Boolean(block && apartment.trim());
  const canTurnOn = valid && (!useCustomDuration || hasValidCustomDuration);

  const sortedActiveExhausts = useMemo(
    () => [...activeExhausts].sort((a, b) => `${a.tower}-${a.final}`.localeCompare(`${b.tower}-${b.final}`, "pt-BR")),
    [activeExhausts],
  );

  const sortedModuleEntries = useMemo(
    () => Object.entries(moduleStatuses).sort((a, b) => a[0].localeCompare(b[0], "pt-BR")),
    [moduleStatuses],
  );

  const onlineModulesCount = useMemo(
    () => sortedModuleEntries.filter(([, moduleStatus]) => Boolean(moduleStatus.status) && !moduleStatus.error).length,
    [sortedModuleEntries],
  );

  const offlineModulesCount = useMemo(
    () => sortedModuleEntries.length - onlineModulesCount,
    [sortedModuleEntries.length, onlineModulesCount],
  );

  const loadProcessStatus = useCallback(async () => {
    setProcessLoading(true);
    setProcessError(null);

    try {
      const statusResponse = await api.exhaustStatusAll();
      setActiveExhausts(statusResponse.memory || []);
      setModuleStatuses(statusResponse.modules || {});
      const latestUpdatedAt = Object.values(statusResponse.modules || {}).reduce<number | null>((latest, moduleStatus) => {
        if (!moduleStatus.updatedAt) return latest;
        if (!latest || moduleStatus.updatedAt > latest) return moduleStatus.updatedAt;
        return latest;
      }, null);
      setGeneratedAt(latestUpdatedAt);
    } catch (err: unknown) {
      setProcessError(`Erro ao carregar status: ${err instanceof Error ? err.message : "Desconhecido"}`);
    } finally {
      setHasLoadedInitialData(true);
      setProcessLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProcessStatus();
  }, [loadProcessStatus]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadProcessStatus();
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadProcessStatus]);

  const onTurnOn = async () => {
    if (!canTurnOn) return;
    setOnLoading(true);

    try {
      await handleExhaustOn(block, apartment.trim(), effectiveDuration);
      await loadProcessStatus();
    } finally {
      setOnLoading(false);
    }
  };

  const onTurnOffFromCard = async (exhaust: ExhaustProcessMemoryItem) => {
    setOffLoadingId(exhaust.id);
    try {
      await handleExhaustOff(exhaust.tower, String(exhaust.final));
      await loadProcessStatus();
    } finally {
      setOffLoadingId(null);
    }
  };

  const onClearFields = () => {
    setBlock("");
    setApartment("");
    setUseCustomDuration(false);
    setCustomDuration(DEFAULT_DURATION_MINUTES);
  };

  const onConfirmTurnOff = async () => {
    if (!exhaustToConfirmOff) return;
    await onTurnOffFromCard(exhaustToConfirmOff);
    setExhaustToConfirmOff(null);
  };

  const previewText = () => {
    if (!valid) return "Selecione bloco e apartamento";
    return `Alvo: Bloco ${block} · Ap ${apartment.trim()} · Duração ${effectiveDuration} min`;
  };

  const formatRemainingTime = (remainingMinutes: number | null) => {
    if (!remainingMinutes || remainingMinutes <= 0) return "--";
    if (remainingMinutes <= 59) return `${remainingMinutes} min`;

    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;

    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}min`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Controle de Exaustores</h1>
          <p className="text-muted-foreground">Gerencie os exaustores das áreas comuns por bloco e apartamento.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={loadProcessStatus}
            disabled={processLoading}
            aria-label="Atualizar status dos exaustores"
            title="Atualizar status dos exaustores"
            className="text-primary hover:bg-primary/10 hover:text-primary active:bg-primary/15"
          >
            <RefreshCw className={`h-4 w-4 ${processLoading ? "animate-spin" : ""}`} />
          </Button>
          <span className="text-xs text-muted-foreground">
            {generatedAt ? `Atualizado em: ${new Date(generatedAt).toLocaleString("pt-BR")}` : "Atualizado em: --"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="h-full w-full p-5">
          <CardHeader className="p-0">
            <div className="flex items-center gap-2">
              <Fan className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base font-semibold">Controle</CardTitle>
                <CardDescription className="text-xs">Ligar exaustor por localização</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="mt-5 p-0">
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <Label htmlFor="ex-block" className="text-xs">Bloco</Label>
                <Select value={block} onValueChange={setBlock}>
                  <SelectTrigger id="ex-block" className="h-9 text-sm">
                    <SelectValue placeholder="Bloco" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOCKS.map((b) => (
                      <SelectItem key={b} value={b}>{humanizeLabel(b)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-9">
                <Label htmlFor="ex-apt" className="text-xs">Apartamento</Label>
                <Input
                  id="ex-apt"
                  placeholder="Ex: 101"
                  value={apartment}
                  onChange={(e) => setApartment(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>

            </div>

            <div className="mt-4 grid grid-cols-1 items-end gap-4 sm:grid-cols-12">
              <div className="sm:col-span-8">
                <Label htmlFor="ex-dur" className="text-xs">Tempo (min)</Label>
                <div className="mt-1 flex items-center gap-3">
                  <Input
                    id="ex-dur"
                    type="number"
                    min={MIN_CUSTOM_DURATION_MINUTES}
                    value={customDuration}
                    onChange={(e) => setCustomDuration(Number(e.target.value))}
                    disabled={!useCustomDuration}
                    className="h-9 w-36 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ex-custom-duration"
                      checked={useCustomDuration}
                      onCheckedChange={setUseCustomDuration}
                    />
                    <Label htmlFor="ex-custom-duration" className="text-xs font-normal text-muted-foreground">
                      Tempo personalizado
                    </Label>
                  </div>
                </div>
                {useCustomDuration && !hasValidCustomDuration && (
                  <p className="mt-1 text-xs text-destructive">
                    O tempo mínimo é {MIN_CUSTOM_DURATION_MINUTES} minutos.
                  </p>
                )}
              </div>

            </div>

            <div className="mt-4 flex items-end justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{previewText()}</p>
                {processError && <p className="text-xs text-destructive">Erro ao atualizar</p>}
              </div>
              <div className="mb-1 flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClearFields}
                  disabled={onLoading}
                  className="h-11 px-5 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary active:bg-primary/20"
                >
                  Limpar
                </Button>
                <Button
                  onClick={onTurnOn}
                  disabled={!canTurnOn || onLoading}
                  className="h-11 min-w-[152px] px-7 text-[0.95rem] font-semibold"
                >
                  {onLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Power className="h-4 w-4 mr-2" />}
                  Ligar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full w-full p-5">
          <CardHeader className="p-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Power className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base font-semibold">Status dos módulos</CardTitle>
                  <CardDescription className="text-xs">Online quando retorna status</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                  Online: {onlineModulesCount}
                </Badge>
                <Badge className="rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50">
                  Offline: {offlineModulesCount}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 mt-5">
            {!hasLoadedInitialData && processLoading ? (
              <div className="rounded-lg border border-border bg-muted px-4 py-8">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando status dos módulos...
                </div>
              </div>
            ) : sortedModuleEntries.length === 0 ? (
              <div className="rounded-lg border border-border bg-muted px-4 py-3">
                <p className="text-sm text-muted-foreground">Nenhum módulo retornado.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {sortedModuleEntries.map(([moduleId, moduleStatus]) => {
                  const isOnline = Boolean(moduleStatus.status) && !moduleStatus.error;
                  const deviceName = moduleStatus.status?.Status?.DeviceName || moduleStatus.status?.Status?.FriendlyName?.[0];
                  const moduleIp = moduleStatus.host || "--";

                  return (
                    <div key={moduleId} className="relative rounded-xl border border-border bg-card px-4 py-4">
                      <Badge
                        className={
                          isOnline
                            ? "absolute right-4 top-3 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50"
                            : "absolute right-4 top-3 rounded-full bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50"
                        }
                      >
                        {isOnline ? "Online" : "Offline"}
                      </Badge>

                      <div className="space-y-1 pr-20 text-xs text-muted-foreground">
                        <p>
                          Módulo: <span className="font-semibold text-foreground">{moduleId}</span>
                        </p>
                        <p>
                          Dispositivo: <span className="font-semibold text-foreground">{deviceName || "--"}</span>
                        </p>
                        <p>
                          IP: <span className="font-semibold text-foreground">{moduleIp}</span>
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {processError && (
        <p className="text-sm text-destructive">{processError}</p>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Exhausts Ligados</h2>
        </div>

        {sortedActiveExhausts.length === 0 ? (
          !hasLoadedInitialData && processLoading ? (
            <div className="rounded-lg border border-border bg-muted px-4 py-8">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando exaustores...
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted px-4 py-3">
              <p className="text-sm text-muted-foreground">Não há nenhum exaustor ligado no momento.</p>
            </div>
          )
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,292px))]">
            {sortedActiveExhausts.map((exhaust) => (
              <Card key={exhaust.id} className="rounded-2xl border-border shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-3xl font-bold leading-none tracking-tight text-foreground">
                      {exhaust.tower}-{exhaust.final}
                    </CardTitle>

                    <div className="flex items-center gap-1">
                      <Badge className="mt-0.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-600" />
                        Em funcionamento
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Acoes do exhaust"
                          >
                            <EllipsisVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => setExhaustToConfirmOff(exhaust)}
                            disabled={offLoadingId === exhaust.id}
                            className="cursor-pointer text-red-600 hover:bg-red-50 hover:text-red-700 focus:bg-red-50 focus:text-red-700"
                          >
                            {offLoadingId === exhaust.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <PowerOff className="mr-2 h-4 w-4" />
                            )}
                            Desligar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="h-px w-full bg-border/80" />

                  <div className="grid grid-cols-2 divide-x divide-slate-200/70 text-sm">
                    <div className="space-y-2 pr-4">
                      <p className="text-xs text-muted-foreground">
                        Torre: <span className="font-semibold text-foreground">{exhaust.tower}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Prumada: <span className="font-semibold text-foreground">{exhaust.final}</span>
                      </p>
                    </div>

                    <div className="space-y-2 pl-4">
                      <p className="text-xs text-muted-foreground">
                        Módulo: <span className="font-semibold text-foreground">{exhaust.group}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Relê: <span className="font-semibold text-foreground">{exhaust.relay}</span>
                      </p>
                    </div>
                  </div>

                  <div className="h-px w-full bg-border/80" />

                  <div className="pb-1 text-center">
                    <p className="text-2xl font-bold leading-none tracking-tight text-foreground">
                      {formatRemainingTime(exhaust.remainingMinutes)}
                    </p>
                    <p className="mt-1.5 text-xs text-muted-foreground">Tempo restante</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog
        open={Boolean(exhaustToConfirmOff)}
        onOpenChange={(open) => {
          if (!open && !offLoadingId) setExhaustToConfirmOff(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar desligamento</AlertDialogTitle>
            <AlertDialogDescription>
              {exhaustToConfirmOff
                ? `Deseja realmente desligar o exaustor ${exhaustToConfirmOff.tower}-${exhaustToConfirmOff.final}?`
                : "Deseja realmente desligar este exaustor?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="ghost"
              onClick={() => setExhaustToConfirmOff(null)}
              disabled={Boolean(offLoadingId)}
              className="bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary active:bg-primary/20"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirmTurnOff}
              disabled={Boolean(offLoadingId)}
            >
              {offLoadingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PowerOff className="mr-2 h-4 w-4" />}
              Confirmar desligamento
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
