import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import type { ExhaustProcessMemoryItem } from "@/services/api";
import { humanizeLabel } from "@/lib/utils";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { notify } from "@/lib/notify";
import { useExhaustProcessStatusQuery } from "@/queries/exhaustQueries";
import { queryKeys } from "@/queries/queryKeys";

const BLOCKS = ["A", "B", "C"];
const DEFAULT_DURATION_MINUTES = 180;
const MIN_CUSTOM_DURATION_MINUTES = 30;

export default function Exaustores() {
  const { handleExhaustOn, handleExhaustOff, exhaustDevices } = useDashboard();
  const queryClient = useQueryClient();
  const processStatusQuery = useExhaustProcessStatusQuery();

  const [block, setBlock] = useState("");
  const [apartment, setApartment] = useState("");
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [customDuration, setCustomDuration] = useState(DEFAULT_DURATION_MINUTES);
  const [onLoading, setOnLoading] = useState(false);
  const [offLoadingId, setOffLoadingId] = useState<string | null>(null);
  const [exhaustToConfirmOff, setExhaustToConfirmOff] = useState<ExhaustProcessMemoryItem | null>(null);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  const hasValidCustomDuration = Number.isFinite(customDuration) && customDuration >= MIN_CUSTOM_DURATION_MINUTES;
  const effectiveDuration = useCustomDuration ? customDuration : DEFAULT_DURATION_MINUTES;
  const valid = Boolean(block && apartment.trim());
  const canTurnOn = valid && (!useCustomDuration || hasValidCustomDuration);

  const activeExhausts = processStatusQuery.data?.memory ?? [];
  const generatedAt = processStatusQuery.data?.generatedAt
    ? new Date(processStatusQuery.data.generatedAt).getTime()
    : null;
  const processLoading = processStatusQuery.isFetching;
  const processError = processStatusQuery.error
    ? `Erro ao carregar status: ${processStatusQuery.error instanceof Error ? processStatusQuery.error.message : "Desconhecido"}`
    : null;

  const sortedActiveExhausts = useMemo(
    () => [...activeExhausts].sort((a, b) => `${a.tower}-${a.final}`.localeCompare(`${b.tower}-${b.final}`, "pt-BR")),
    [activeExhausts],
  );

  useEffect(() => {
    if (processStatusQuery.isSuccess || processStatusQuery.isError) {
      setHasLoadedInitialData(true);
    }
  }, [processStatusQuery.isError, processStatusQuery.isSuccess]);

  const resolveModuleIdBySelection = (towerValue: string, apartmentValue: string): string | null => {
    const tower = towerValue.trim().toUpperCase();
    const lastDigitMatch = apartmentValue.trim().match(/(\d)\D*$/);
    if (!tower || !lastDigitMatch) return null;
    const final = Number(lastDigitMatch[1]);
    if (!Number.isFinite(final) || final < 1 || final > 8) return null;
    const group = final <= 4 ? "14" : "58";
    return `${tower}_${group}`;
  };

  const onTurnOn = async () => {
    if (!canTurnOn) return;

    const moduleId = resolveModuleIdBySelection(block, apartment);
    if (!moduleId) {
      notify.warning("Apartamento invalido", { description: "Informe um apartamento com final de 1 a 8." });
      return;
    }

    const cachedModule = exhaustDevices.find((device) => device.id.trim().toUpperCase() === moduleId);
    if (!cachedModule) {
      notify.warning("Modulo nao encontrado no cache", {
        description: `Nao foi possivel localizar o modulo ${moduleId}. Atualize os equipamentos e tente novamente.`,
      });
      return;
    }

    if (!cachedModule.online) {
      notify.error("Modulo offline", {
        description: `${cachedModule.nome || moduleId} esta offline. Comando de ligar nao foi enviado.`,
      });
      return;
    }

    notify.success("Modulo online", { description: `${cachedModule.nome || moduleId} pronto para acionamento.` });

    setOnLoading(true);

    try {
      await handleExhaustOn(block, apartment.trim(), effectiveDuration);
      await queryClient.invalidateQueries({ queryKey: queryKeys.exhaust.processStatus() });
    } finally {
      setOnLoading(false);
    }
  };

  const onTurnOffFromCard = async (exhaust: ExhaustProcessMemoryItem) => {
    setOffLoadingId(exhaust.id);
    try {
      await handleExhaustOff(exhaust.tower, String(exhaust.final));
      await queryClient.invalidateQueries({ queryKey: queryKeys.exhaust.processStatus() });
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
    <PageContainer>
      <PageHeader
        title="Controle de Exaustores"
        description="Gerencie os exaustores das areas comuns por bloco e apartamento."
        actions={(
          <Button variant="outline" onClick={() => void processStatusQuery.refetch()} disabled={processLoading} className="h-9">
            <RefreshCw className={`mr-2 h-4 w-4 ${processLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        )}
      />
      <p className="typo-caption">
        {generatedAt ? `Atualizado em: ${new Date(generatedAt).toLocaleString("pt-BR")}` : "Atualizado em: --"}
      </p>

      <div>
        <Card className="h-full w-full p-5">
          <CardHeader className="p-0">
            <div className="flex items-center gap-2">
              <Fan className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Controle</CardTitle>
                <CardDescription>Ligar exaustor por localização</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="mt-5 p-0">
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-12">
              <div className="sm:col-span-3">
                <Label htmlFor="ex-block" className="typo-label">Bloco</Label>
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
                <Label htmlFor="ex-apt" className="typo-label">Apartamento</Label>
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
                <Label htmlFor="ex-dur" className="typo-label">Tempo (min)</Label>
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
                    <Label htmlFor="ex-custom-duration" className="typo-caption font-normal">
                      Tempo personalizado
                    </Label>
                  </div>
                </div>
                {useCustomDuration && !hasValidCustomDuration && (
                  <p className="mt-1 typo-caption text-destructive">
                    O tempo mínimo é {MIN_CUSTOM_DURATION_MINUTES} minutos.
                  </p>
                )}
              </div>

            </div>

            <div className="mt-4 flex items-end justify-between gap-4">
              <div className="space-y-1">
                <p className="typo-caption">{previewText()}</p>
                {processError && <p className="typo-caption text-destructive">Erro ao atualizar</p>}
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
      </div>

      {processError && (
        <p className="typo-body text-destructive">{processError}</p>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="typo-section-title">Exhausts Ligados</h2>
        </div>

        {sortedActiveExhausts.length === 0 ? (
          !hasLoadedInitialData && processLoading ? (
            <div className="rounded-lg border border-border bg-muted px-4 py-8">
              <div className="flex items-center justify-center gap-2 typo-body text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando exaustores...
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted px-4 py-3">
              <p className="typo-body text-muted-foreground">Não há nenhum exaustor ligado no momento.</p>
            </div>
          )
        ) : (
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,292px))]">
            {sortedActiveExhausts.map((exhaust) => (
              <Card key={exhaust.id} className="rounded-2xl border-border shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="typo-section-title">
                      {exhaust.tower}-{exhaust.final}
                    </CardTitle>

                    <div className="flex items-center gap-1">
                      <Badge className="mt-0.5 rounded-full state-success-soft px-3 py-1.5 typo-caption font-medium">
                        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-status-success-solid" />
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
                            className="cursor-pointer text-status-danger-solid hover:bg-status-danger-soft hover:text-status-danger-soft-foreground focus:bg-status-danger-soft focus:text-status-danger-soft-foreground"
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

                  <div className="grid grid-cols-2 divide-x divide-border/80 typo-body">
                    <div className="space-y-2 pr-4">
                      <p className="typo-caption">
                        Torre: <span className="font-semibold text-foreground">{exhaust.tower}</span>
                      </p>
                      <p className="typo-caption">
                        Prumada: <span className="font-semibold text-foreground">{exhaust.final}</span>
                      </p>
                    </div>

                    <div className="space-y-2 pl-4">
                      <p className="typo-caption">
                        Módulo: <span className="font-semibold text-foreground">{exhaust.group}</span>
                      </p>
                      <p className="typo-caption">
                        Relê: <span className="font-semibold text-foreground">{exhaust.relay}</span>
                      </p>
                    </div>
                  </div>

                  <div className="h-px w-full bg-border/80" />

                  <div className="pb-1 text-center">
                    <p className="typo-section-title">
                      {formatRemainingTime(exhaust.remainingMinutes)}
                    </p>
                    <p className="mt-1.5 typo-caption">Tempo restante</p>
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
    </PageContainer>
  );
}
