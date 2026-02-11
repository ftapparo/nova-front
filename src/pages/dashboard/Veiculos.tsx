import { useEffect, useMemo, useState, type KeyboardEventHandler } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Plus, Search, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type AccessVerifyItem, type CpfQueryResponse, type VehicleLookupResponse, type VehicleSummary } from "@/services/api";
import { notify } from "@/lib/notify";
import { useDashboard } from "@/contexts/DashboardContext";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import SectionCardHeader from "@/components/layout/SectionCardHeader";

type ApiErrorWithPayload = Error & {
  status?: number;
  payload?: {
    message?: string | null;
    errors?: {
      requiresConfirmation?: boolean;
      currentTag?: string | null;
    } | null;
  } | null;
};

const WIDE_VIEWPORT_MIN_WIDTH = 1200;

const normalizePlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
const normalizeDigits = (value: string) => value.replace(/\D/g, "");

const isSwapConfirmationError = (error: unknown): boolean => {
  const apiError = error as ApiErrorWithPayload;
  return apiError?.status === 409 && Boolean(apiError?.payload?.errors?.requiresConfirmation);
};

export default function Veiculos() {
  const { gates } = useDashboard();
  const entryGates = useMemo(
    () => (gates || []).filter((gate) => String(gate.sentido || "").trim().toUpperCase() === "E"),
    [gates],
  );

  const [cpf, setCpf] = useState("");
  const [ownerData, setOwnerData] = useState<CpfQueryResponse | null>(null);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [loadingOwner, setLoadingOwner] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [ownerAccessInfo, setOwnerAccessInfo] = useState<AccessVerifyItem | null>(null);
  const [ownerAccessAllowed, setOwnerAccessAllowed] = useState(false);
  const [ownerAccessMessage, setOwnerAccessMessage] = useState<string | null>(null);

  const [selectedUnitSeq, setSelectedUnitSeq] = useState("");

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addPlate, setAddPlate] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<VehicleLookupResponse | null>(null);
  const [savingVehicle, setSavingVehicle] = useState(false);

  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagVehicle, setTagVehicle] = useState<VehicleSummary | null>(null);
  const [tagValue, setTagValue] = useState("");
  const [savingTag, setSavingTag] = useState(false);
  const [removingTag, setRemovingTag] = useState(false);

  const [swapConfirmOpen, setSwapConfirmOpen] = useState(false);
  const [pendingSwapVehicleSeq, setPendingSwapVehicleSeq] = useState<number | null>(null);
  const [unlinkingVehicleSeq, setUnlinkingVehicleSeq] = useState<number | null>(null);
  const [removeTagConfirmOpen, setRemoveTagConfirmOpen] = useState(false);
  const [pendingRemoveTagVehicle, setPendingRemoveTagVehicle] = useState<VehicleSummary | null>(null);
  const [unlinkVehicleConfirmOpen, setUnlinkVehicleConfirmOpen] = useState(false);
  const [pendingUnlinkVehicle, setPendingUnlinkVehicle] = useState<VehicleSummary | null>(null);
  const [isWideViewport, setIsWideViewport] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const evaluateViewport = () => {
      setIsWideViewport(window.innerWidth >= WIDE_VIEWPORT_MIN_WIDTH);
    };

    evaluateViewport();
    window.addEventListener("resize", evaluateViewport);
    return () => window.removeEventListener("resize", evaluateViewport);
  }, []);

  const hasOwner = Boolean(ownerData?.person?.sequencia);
  const validationDevice = entryGates[0]?.numeroDispositivo ?? null;

  const validateOwnerAccess = async (cpfDigits: string): Promise<void> => {
    setOwnerAccessInfo(null);
    setOwnerAccessAllowed(false);
    setOwnerAccessMessage(null);

    if (!validationDevice) {
      setOwnerAccessMessage("Nenhum portao de entrada disponivel para validacao.");
      return;
    }

    try {
      const result = await api.accessVerify(cpfDigits, Number(validationDevice), "E");
      const person = result?.[0] ?? null;

      if (!person) {
        setOwnerAccessMessage("Nenhum cadastro encontrado para este CPF.");
        return;
      }

      const permitido = (person.PERMITIDO || "").trim().toUpperCase() === "S";
      const perfilValido = ["PROP", "LOC", "MOR"].some((key) => (person[key as "PROP" | "LOC" | "MOR"] || "").trim().toUpperCase() === "S");
      const allowed = permitido && perfilValido;

      setOwnerAccessInfo(person);
      setOwnerAccessAllowed(allowed);
      setOwnerAccessMessage(
        allowed ? "Vinculo confirmado. Cadastro de veiculos permitido." : "Vinculo nao permite cadastro de veiculos.",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao validar acesso por CPF.";
      setOwnerAccessMessage(message);
      setOwnerAccessInfo(null);
      setOwnerAccessAllowed(false);
    }
  };

  const refreshVehiclesByOwner = async (personSeq: number) => {
    setLoadingList(true);
    try {
      const list = await api.vehicleListByOwner(personSeq);
      setVehicles(list || []);
    } finally {
      setLoadingList(false);
    }
  };

  const onSearchCpf = async () => {
    const cpfDigits = normalizeDigits(cpf);
    if (cpfDigits.length !== 11) {
      notify.warning("CPF invalido", { description: "Informe 11 digitos." });
      return;
    }

    setLoadingOwner(true);
    setOwnerAccessInfo(null);
    setOwnerAccessAllowed(false);
    setOwnerAccessMessage(null);
    try {
      const response = await api.queryCpf(cpfDigits);
      setOwnerData(response);

      if (!response.exists || !response.person) {
        setVehicles([]);
        notify.warning("CPF nao encontrado");
        return;
      }

      const defaultUnit =
        response.links?.[0]?.pessoaVinculo?.seqUnidade ?? response.links?.[0]?.unidade?.sequencia ?? null;

      setSelectedUnitSeq(defaultUnit ? String(defaultUnit) : "");
      await validateOwnerAccess(cpfDigits);
      await refreshVehiclesByOwner(Number(response.person.sequencia));
      notify.success("Proprietario carregado");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao consultar CPF.";
      notify.error("Erro ao consultar CPF", { description: message });
    } finally {
      setLoadingOwner(false);
    }
  };

  const onCpfKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (loadingOwner) return;

    if (event.key === "Enter") {
      event.preventDefault();
      void onSearchCpf();
      return;
    }

    if (event.key === "Tab") {
      void onSearchCpf();
    }
  };

  const openAddVehicleModal = () => {
    if (!hasOwner) {
      notify.warning("Busque o proprietario por CPF primeiro.");
      return;
    }

    setAddModalOpen(true);
    setAddPlate("");
    setLookupResult(null);
  };

  const onLookupPlate = async () => {
    const plate = normalizePlate(addPlate);
    if (plate.length !== 7) {
      notify.warning("Placa invalida", { description: "Informe 7 caracteres da placa." });
      return;
    }

    setLookupLoading(true);
    try {
      const result = await api.vehicleLookupPlate(plate);
      setLookupResult(result);
      if (!result.overallSuccess) {
        notify.warning("Consulta externa sem dados validos.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na consulta externa.";
      notify.error("Erro ao consultar placa", { description: message });
    } finally {
      setLookupLoading(false);
    }
  };

  const onApproveAndSaveVehicle = async () => {
    if (!ownerData?.person?.sequencia) return;
    if (!lookupResult?.overallSuccess) {
      notify.warning("Nao ha dados consolidados para aprovar.");
      return;
    }

    setSavingVehicle(true);
    try {
      await api.vehicleUpsertByPlate({
        plate: lookupResult.plate,
        brand: lookupResult.consolidated.brand || "",
        model: lookupResult.consolidated.model || "",
        color: lookupResult.consolidated.color || "",
        ownerSeq: Number(ownerData.person.sequencia),
        unitSeq: selectedUnitSeq ? Number(selectedUnitSeq) : null,
      });

      await refreshVehiclesByOwner(Number(ownerData.person.sequencia));
      setAddModalOpen(false);
      setLookupResult(null);
      setAddPlate("");
      notify.success("Veiculo gravado com sucesso");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao gravar veiculo.";
      notify.error("Erro ao salvar veiculo", { description: message });
    } finally {
      setSavingVehicle(false);
    }
  };

  const openTagModal = (vehicle: VehicleSummary) => {
    setTagVehicle(vehicle);
    setTagValue(normalizeDigits(vehicle.TAGVEICULO || ""));
    setTagModalOpen(true);
  };

  const saveTag = async (vehicleSeq: number, forceSwap: boolean) => {
    if (!ownerData?.person?.sequencia) return;
    const tagDigits = normalizeDigits(tagValue);
    if (tagDigits.length !== 10) {
      notify.warning("Tag invalida", { description: "Informe 10 digitos." });
      return;
    }
    if (!validationDevice) {
      notify.warning("Nenhum portao de entrada disponivel para validacao.");
      return;
    }

    setSavingTag(true);
    try {
      await api.vehicleLinkTag(vehicleSeq, {
        cpf: normalizeDigits(cpf),
        tag: tagDigits,
        dispositivo: Number(validationDevice),
        forceSwap,
        user: "PORTARIA",
      });

      await refreshVehiclesByOwner(Number(ownerData.person.sequencia));
      setTagModalOpen(false);
      setTagVehicle(null);
      setTagValue("");
      notify.success(forceSwap ? "Tag trocada com sucesso" : "Tag vinculada com sucesso");
    } catch (error) {
      if (!forceSwap && isSwapConfirmationError(error)) {
        setPendingSwapVehicleSeq(vehicleSeq);
        setSwapConfirmOpen(true);
        return;
      }

      const message = error instanceof Error ? error.message : "Falha ao salvar tag.";
      notify.error("Erro ao salvar tag", { description: message });
    } finally {
      setSavingTag(false);
    }
  };

  const onConfirmSwapTag = async () => {
    if (!pendingSwapVehicleSeq) return;
    await saveTag(pendingSwapVehicleSeq, true);
    setSwapConfirmOpen(false);
    setPendingSwapVehicleSeq(null);
  };

  const onRemoveTag = async (vehicle: VehicleSummary) => {
    if (!ownerData?.person?.sequencia) return;

    setRemovingTag(true);
    try {
      await api.vehicleRemoveTag(Number(vehicle.SEQUENCIA));
      await refreshVehiclesByOwner(Number(ownerData.person.sequencia));
      if (tagVehicle?.SEQUENCIA === vehicle.SEQUENCIA) {
        setTagVehicle(null);
        setTagModalOpen(false);
      }
      notify.success("Tag removida com sucesso");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao remover tag.";
      notify.error("Erro ao remover tag", { description: message });
    } finally {
      setRemovingTag(false);
    }
  };

  const onUnlinkVehicle = async (vehicle: VehicleSummary) => {
    if (!ownerData?.person?.sequencia) return;

    setUnlinkingVehicleSeq(Number(vehicle.SEQUENCIA));
    try {
      await api.vehicleUnlinkOwner(Number(vehicle.SEQUENCIA));
      await refreshVehiclesByOwner(Number(ownerData.person.sequencia));
      notify.success("Veiculo desvinculado do proprietario");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao desvincular veiculo.";
      notify.error("Erro ao desvincular veiculo", { description: message });
    } finally {
      setUnlinkingVehicleSeq(null);
    }
  };

  const requestRemoveTag = (vehicle: VehicleSummary) => {
    setPendingRemoveTagVehicle(vehicle);
    setRemoveTagConfirmOpen(true);
  };

  const confirmRemoveTag = async () => {
    if (!pendingRemoveTagVehicle) return;
    await onRemoveTag(pendingRemoveTagVehicle);
    setRemoveTagConfirmOpen(false);
    setPendingRemoveTagVehicle(null);
  };

  const requestUnlinkVehicle = (vehicle: VehicleSummary) => {
    setPendingUnlinkVehicle(vehicle);
    setUnlinkVehicleConfirmOpen(true);
  };

  const confirmUnlinkVehicle = async () => {
    if (!pendingUnlinkVehicle) return;
    await onUnlinkVehicle(pendingUnlinkVehicle);
    setUnlinkVehicleConfirmOpen(false);
    setPendingUnlinkVehicle(null);
  };

  const renderButtonLabel = (label: string) => (isWideViewport ? label : <span className="sr-only">{label}</span>);
  const iconSpacingClass = isWideViewport ? "mr-2" : "";
  const compactIconSizeClass = isWideViewport ? "h-4 w-4" : "!h-6 !w-6";
  type CompactButtonStyle = "primary" | "outline" | "destructive";
  const compactButtonClassMap: Record<CompactButtonStyle, string> = {
    primary: "bg-transparent text-primary hover:bg-primary/10 border-none shadow-none px-2",
    outline: "bg-transparent text-muted-foreground hover:bg-muted/40 border-none shadow-none px-2",
    destructive: "bg-transparent text-rose-600 hover:bg-rose-50 border-none shadow-none px-2",
  };
  const getCompactButtonClasses = (style: CompactButtonStyle): string => (isWideViewport ? "" : compactButtonClassMap[style]);
  const addVehicleIconOnlyClasses = "h-12 w-12 min-w-[3rem] rounded-full bg-primary text-primary-foreground p-0 shadow-md hover:bg-primary/90 focus-visible:ring-primary";

  return (
    // ✅ 1) Container com max-width e centralizado (evita esticar em ultra-wide)
    <PageContainer>
      <PageHeader title="Veiculos" description="Cadastro, tag e desvinculo de veiculos por proprietario." />

      <Card>
        <SectionCardHeader title="Buscar Pessoa" description="Digite o CPF para carregar os dados cadatrais." />

        <CardContent className="space-y-3">
          {/* ✅ 2) Input + ação juntos, com largura controlada */}
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-md">
              {/* ícone dentro do input (lupa próxima do contexto) */}
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                inputMode="numeric"
                value={cpf}
                onChange={(event) => setCpf(event.target.value)}
                onKeyDown={onCpfKeyDown}
                placeholder="CPF"
                className="h-9 pl-9"
              />
            </div>

            {/* botão de ação explícito (melhor do que um ícone solto) */}
            <Button
              type="button"
              onClick={() => void onSearchCpf()}
              disabled={normalizeDigits(cpf).length < 11 || loadingOwner}
              className={`h-9 ${getCompactButtonClasses("primary")}`}
              aria-label="Buscar Pessoa"
            >
              {loadingOwner ? (
                <Loader2 className={`${iconSpacingClass} ${compactIconSizeClass} animate-spin`} />
              ) : (
                <Search className={`${iconSpacingClass} ${compactIconSizeClass}`} />
              )}
              {renderButtonLabel("Buscar")}
            </Button>
          </div>

          {ownerData?.person ? (
            <div className="text-sm space-y-2">
              <div
                className={`mt-2 min-h-[132px] rounded-md border px-3 py-2 text-sm ${!ownerAccessMessage && !ownerAccessInfo
                  ? "border-border bg-muted text-muted-foreground"
                  : ownerAccessAllowed
                    ? "border-emerald-200 bg-emerald-100 text-emerald-900"
                    : "border-rose-200 bg-rose-100 text-rose-900"
                  }`}
              >
                {ownerAccessInfo ? (
                  <>
                    <p className="font-medium">{ownerAccessInfo.NOME?.trim() || "--"}</p>
                    <p>
                      Unidade: {ownerAccessInfo.QUADRA?.trim() || "--"} {ownerAccessInfo.LOTE?.trim() || "--"}
                    </p>
                    <p>Tipo: {ownerAccessInfo.DESCRICAO?.trim() || "--"}</p>
                    <p>Permitido: {(ownerAccessInfo.PERMITIDO || "").trim().toUpperCase() === "S" ? "Sim" : "Nao"}</p>
                  </>
                ) : (
                  <p className="pt-2 text-xs">Consulte um CPF para validar acesso e perfil.</p>
                )}

                {ownerAccessMessage ? (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {ownerAccessAllowed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <span>{ownerAccessMessage}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <SectionCardHeader
          title="Veiculos"
          description="Gerencie e edite os veiculos vinculados."
          action={
            <Button
              type="button"
              onClick={openAddVehicleModal}
              disabled={!hasOwner}
              aria-label="Adicionar veiculo"
              className={isWideViewport ? "" : addVehicleIconOnlyClasses}
            >
              <Plus className={`${iconSpacingClass} ${compactIconSizeClass}`} />
              {renderButtonLabel("Adicionar veiculo")}
            </Button>
          }
        />

        <CardContent>
          {loadingList ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando veiculos...
            </div>
          ) : vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum veiculo para exibir.</p>
          ) : (
            <div className="space-y-3">
              {vehicles.map((vehicle) => {
                const hasTag = Boolean((vehicle.TAGVEICULO || "").trim());
                return (
                  // ✅ 3) Item com layout mais “card-like” e responsivo
                  <div key={vehicle.SEQUENCIA} className="rounded-md border p-4 text-sm">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <div className="space-y-1">
                        <p>
                          <strong>Placa:</strong> {vehicle.PLACA}
                        </p>
                        <p>
                          <strong>Tag:</strong> {vehicle.TAGVEICULO || "--"}
                        </p>
                        <p>
                          <strong>Marca:</strong> {vehicle.MARCA || "--"}
                        </p>
                        <p>
                          <strong>Modelo:</strong> {vehicle.MODELO || "--"}
                        </p>
                        <p>
                          <strong>Cor:</strong> {vehicle.COR || "--"}
                        </p>
                      </div>

                      {/* ações ficam “perto” e alinhadas; no desktop vão para a direita */}
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openTagModal(vehicle)}
                          aria-label={hasTag ? "Editar tag" : "Adicionar tag"}
                          className={getCompactButtonClasses("primary")}
                        >
                          {hasTag ? (
                            <Pencil className={`${iconSpacingClass} ${compactIconSizeClass}`} />
                          ) : (
                            <Plus className={`${iconSpacingClass} ${compactIconSizeClass}`} />
                          )}
                          {renderButtonLabel(hasTag ? "Editar tag" : "Adicionar tag")}
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => requestUnlinkVehicle(vehicle)}
                          disabled={unlinkingVehicleSeq === Number(vehicle.SEQUENCIA)}
                          aria-label="Excluir veiculo"
                          className={getCompactButtonClasses("destructive")}
                        >
                          {unlinkingVehicleSeq === Number(vehicle.SEQUENCIA) ? (
                            <Loader2 className={`${iconSpacingClass} ${compactIconSizeClass} animate-spin`} />
                          ) : (
                            <Trash2 className={`${iconSpacingClass} ${compactIconSizeClass}`} />
                          )}
                          {renderButtonLabel("Excluir veiculo")}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar veiculo por placa</DialogTitle>
            <DialogDescription>Executa 3 consultas externas para validar marca, modelo e cor.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* ✅ 4) Campo de placa com largura confortável */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="w-full sm:max-w-xs">
                <Label>Placa</Label>
                <Input
                  value={addPlate}
                  onChange={(event) => setAddPlate(normalizePlate(event.target.value))}
                  placeholder="AAA0A00"
                  className="h-9"
                />
              </div>
              <Button
                type="button"
                onClick={() => void onLookupPlate()}
                disabled={lookupLoading}
                className={`h-9 ${getCompactButtonClasses("primary")}`}
                aria-label="Consultar placa"
              >
                {lookupLoading ? (
                  <Loader2 className={`${iconSpacingClass} ${compactIconSizeClass} animate-spin`} />
                ) : (
                  <Search className={`${iconSpacingClass} ${compactIconSizeClass}`} />
                )}
                {renderButtonLabel("Consultar")}
              </Button>
            </div>

            <div className="space-y-2">
              {(lookupResult?.sources || [
                { name: "API1", success: false, message: "Aguardando consulta", durationMs: 0, data: null },
                { name: "API2", success: false, message: "Aguardando consulta", durationMs: 0, data: null },
                { name: "API3", success: false, message: "Aguardando consulta", durationMs: 0, data: null },
              ]).map((source) => (
                <div key={source.name} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>{source.name}</span>
                  <span className="flex items-center gap-2">
                    {lookupLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : source.success ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-rose-600" />
                    )}
                    <span>{source.message}</span>
                  </span>
                </div>
              ))}
            </div>

            {lookupResult ? (
              <div className="rounded-md border bg-muted p-3 text-sm space-y-1">
                <p>
                  <strong>Placa:</strong> {lookupResult.plate}
                </p>
                <p>
                  <strong>Marca:</strong> {lookupResult.consolidated.brand || "--"}
                </p>
                <p>
                  <strong>Modelo:</strong> {lookupResult.consolidated.model || "--"}
                </p>
                <p>
                  <strong>Cor:</strong> {lookupResult.consolidated.color || "--"}
                </p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)} disabled={savingVehicle}>
              Cancelar
            </Button>
            <Button onClick={() => void onApproveAndSaveVehicle()} disabled={!lookupResult?.overallSuccess || savingVehicle}>
              {savingVehicle ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Aprovar e gravar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tagModalOpen} onOpenChange={setTagModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tagVehicle?.TAGVEICULO ? "Editar tag" : "Adicionar tag"}</DialogTitle>
            <DialogDescription>{tagVehicle ? `Veiculo ${tagVehicle.PLACA}` : "Informe os dados da tag."}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Numero da tag</Label>
              <Input
                inputMode="numeric"
                value={tagValue}
                onChange={(event) => setTagValue(normalizeDigits(event.target.value))}
                placeholder="10 digitos"
                className="h-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">Validacao automatica usando o primeiro portao de entrada disponivel.</p>
          </div>

          <DialogFooter className="gap-2">
            {tagVehicle?.TAGVEICULO ? (
              <Button type="button" variant="outline" onClick={() => requestRemoveTag(tagVehicle)} disabled={removingTag}>
                {removingTag ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Excluir tag
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setTagModalOpen(false)} disabled={savingTag}>
              Cancelar
            </Button>
            <Button onClick={() => tagVehicle && void saveTag(Number(tagVehicle.SEQUENCIA), false)} disabled={savingTag || !tagVehicle}>
              {savingTag ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={swapConfirmOpen} onOpenChange={setSwapConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar troca de tag</DialogTitle>
            <DialogDescription>Este veiculo ja possui uma tag. Deseja substituir pela nova tag informada?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwapConfirmOpen(false)} disabled={savingTag}>
              Cancelar
            </Button>
            <Button onClick={() => void onConfirmSwapTag()} disabled={savingTag}>
              {savingTag ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar troca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeTagConfirmOpen} onOpenChange={setRemoveTagConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusao de tag</DialogTitle>
            <DialogDescription>
              {pendingRemoveTagVehicle
                ? `Deseja excluir a tag do veiculo ${pendingRemoveTagVehicle.PLACA}?`
                : "Deseja excluir a tag deste veiculo?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTagConfirmOpen(false)} disabled={removingTag}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirmRemoveTag()} disabled={removingTag}>
              {removingTag ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={unlinkVehicleConfirmOpen} onOpenChange={setUnlinkVehicleConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusao de veiculo</DialogTitle>
            <DialogDescription>
              {pendingUnlinkVehicle
                ? `Deseja desvincular o veiculo ${pendingUnlinkVehicle.PLACA} do proprietario?`
                : "Deseja desvincular este veiculo do proprietario?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlinkVehicleConfirmOpen(false)} disabled={Boolean(unlinkingVehicleSeq)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirmUnlinkVehicle()} disabled={Boolean(unlinkingVehicleSeq)}>
              {unlinkingVehicleSeq ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir veiculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
