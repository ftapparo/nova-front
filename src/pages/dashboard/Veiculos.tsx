import { useEffect, useMemo, useState, type KeyboardEventHandler } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Plus, Search, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  api,
  type AccessVerifyItem,
  type CpfQueryResponse,
  type VehicleLookupProvider,
  type VehicleLookupResponse,
  type VehicleLookupSourceResult,
  type VehicleSummary,
} from "@/services/api";
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
const LOOKUP_PROVIDERS: VehicleLookupProvider[] = ["API1", "API2", "API3"];
const LOOKUP_ATTEMPT_LABELS = ["primeira", "segunda", "terceira"];

const normalizePlate = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
const normalizeDigits = (value: string) => value.replace(/\D/g, "");
const normalizeSeq = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatCpf = (value: string | null | undefined): string => {
  const digits = normalizeDigits(String(value || ""));
  if (digits.length !== 11) return String(value || "nao informado");
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};
type LookupAttemptStatus = "pending" | "success" | "warning" | "error";
type LookupAttemptLine = {
  id: string;
  status: LookupAttemptStatus;
  message: string;
  details?: string[];
};

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
  const [lookupAttemptLines, setLookupAttemptLines] = useState<LookupAttemptLine[]>([]);
  const [manualBrand, setManualBrand] = useState("");
  const [manualModel, setManualModel] = useState("");
  const [manualColor, setManualColor] = useState("");
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
      setOwnerAccessMessage("Nenhum portão de entrada disponível para validação.");
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
        allowed ? "Vínculo confirmado. Cadastro de veículos permitido." : "Vínculo não permite cadastro de veículos.",
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
      notify.warning("CPF inválido", { description: "Informe 11 dígitos." });
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
        notify.warning("CPF não encontrado");
        return;
      }

      const defaultUnit =
        response.links?.[0]?.pessoaVinculo?.seqUnidade ?? response.links?.[0]?.unidade?.sequencia ?? null;

      setSelectedUnitSeq(defaultUnit ? String(defaultUnit) : "");
      await validateOwnerAccess(cpfDigits);
      await refreshVehiclesByOwner(Number(response.person.sequencia));
      notify.success("Proprietário carregado");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao consultar CPF.";
      notify.error("Erro ao consultar CPF", { description: message });
    } finally {
      setLoadingOwner(false);
    }
  };

  const onClearSearch = () => {
    setCpf("");
    setOwnerData(null);
    setVehicles([]);
    setSelectedUnitSeq("");
    setOwnerAccessInfo(null);
    setOwnerAccessAllowed(false);
    setOwnerAccessMessage(null);
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
      notify.warning("Busque o proprietário por CPF primeiro.");
      return;
    }

    setAddModalOpen(true);
    setAddPlate("");
    setLookupResult(null);
    setLookupAttemptLines([]);
    setManualBrand("");
    setManualModel("");
    setManualColor("");
  };

  const onLookupPlate = async () => {
    const plate = normalizePlate(addPlate);
    if (plate.length !== 7) {
      notify.warning("Placa inválida", { description: "Informe 7 caracteres da placa." });
      return;
    }

    setLookupLoading(true);
    setLookupResult(null);
    setLookupAttemptLines([]);
    setManualBrand("");
    setManualModel("");
    setManualColor("");

    try {
      const localDetails = await api.vehicleByPlate(plate);
      const localVehicle = localDetails?.vehicle ?? null;

      if (localDetails?.exists && localVehicle) {
        const currentOwnerSeq = normalizeSeq(ownerData?.person?.sequencia);
        const currentUnitSeq = selectedUnitSeq ? normalizeSeq(selectedUnitSeq) : 0;
        const vehicleOwnerSeq = normalizeSeq(localVehicle.PROPRIETARIO);
        const vehicleUnitSeq = normalizeSeq(localVehicle.SEQUNIDADE);
        const isLinkedToAny = vehicleOwnerSeq > 0 || vehicleUnitSeq > 0;
        const isDifferentOwner = vehicleOwnerSeq !== currentOwnerSeq || vehicleUnitSeq !== currentUnitSeq;

        if (isLinkedToAny && isDifferentOwner) {
          const ownerName = (localVehicle.OWNERNOME || "").trim() || `SEQ ${vehicleOwnerSeq}`;
          const ownerCpf = formatCpf(localVehicle.OWNERCPF);
          const unit = (localVehicle.UNIDADELOTE || "").trim() || String(vehicleUnitSeq || "--");
          const block = (localVehicle.UNIDADEQUADRA || "").trim() || "--";
          setLookupAttemptLines([
            {
              id: `LOCAL-CONFLICT-${Date.now()}`,
              status: "warning",
              message: "Placa já vinculada a outro cadastro.",
              details: [
                `Proprietário: ${ownerName}`,
                `CPF: ${ownerCpf}`,
                `Unidade: ${unit} | Bloco: ${block}`,
                "Para transferir, acesse o cadastro do CPF atual e remova o veículo primeiro.",
              ],
            },
          ]);
          return;
        }
        const sourceMessage = isLinkedToAny ?
          "Veículo ja cadastrado para este proprietario na base local." :
          "Veículo encontrado na base local.";
        setLookupAttemptLines([{ id: `LOCAL-${Date.now()}`, status: "success", message: sourceMessage, },]);
        const hasAnyData = Boolean(localVehicle.MARCA || localVehicle.MODELO || localVehicle.COR);
        setLookupResult({
          plate,
          sources: [{
            name: "LOCAL",
            success: true,
            durationMs: 0,
            message: sourceMessage,
            data: {
              brand: localVehicle.MARCA || null,
              model: localVehicle.MODELO || null,
              color: localVehicle.COR || null,
            },
          }],
          consolidated: {
            brand: localVehicle.MARCA || null,
            model: localVehicle.MODELO || null,
            color: localVehicle.COR || null,
            sourceUsedByField: {
              brand: localVehicle.MARCA ? "LOCAL" : null,
              model: localVehicle.MODELO ? "LOCAL" : null,
              color: localVehicle.COR ? "LOCAL" : null,
            },
          },
          overallSuccess: hasAnyData,
        });

        setManualBrand(localVehicle.MARCA || "");
        setManualModel(localVehicle.MODELO || "");
        setManualColor(localVehicle.COR || "");
        return;
      }

      const attemptedSources: VehicleLookupSourceResult[] = [];
      let consolidatedResult: VehicleLookupResponse["consolidated"] | null = null;

      for (const [index, provider] of LOOKUP_PROVIDERS.entries()) {
        const attemptId = `${provider}-${Date.now()}-${index}`;
        const attemptLabel = LOOKUP_ATTEMPT_LABELS[index] || String(index + 1);

        setLookupAttemptLines((previous) => [
          ...previous,
          {
            id: attemptId,
            status: "pending",
            message: `Pesquisando placa do veículo, ${attemptLabel} tentativa... aguarde.`,
          },
        ]);

        try {
          // eslint-disable-next-line no-await-in-loop
          const result = await api.vehicleLookupPlate(plate, provider);
          const sourceResult =
            result.sources.find((source) => source.name === provider)
            || {
              name: provider,
              success: result.overallSuccess,
              durationMs: 0,
              message: result.overallSuccess ? "Consulta realizada com sucesso." : "Consulta sem dados de veículo.",
              data: {
                brand: result.consolidated.brand,
                model: result.consolidated.model,
                color: result.consolidated.color,
              },
            };

          attemptedSources.push(sourceResult);

          if (result.overallSuccess) {
            setLookupAttemptLines((previous) =>
              previous.map((line) =>
                line.id === attemptId
                  ? { ...line, status: "success", message: "Pesquisa de veículo realizada com sucesso." }
                  : line,
              ),
            );
            consolidatedResult = result.consolidated;
            break;
          }

          setLookupAttemptLines((previous) =>
            previous.map((line) =>
              line.id === attemptId
                ? { ...line, status: "error", message: "Não foi possível localizar dados nesta tentativa." }
                : line,
            ),
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha na consulta externa.";
          attemptedSources.push({
            name: provider,
            success: false,
            durationMs: 0,
            message,
            data: null,
          });

          setLookupAttemptLines((previous) =>
            previous.map((line) =>
              line.id === attemptId
                ? { ...line, status: "error", message: "Não foi possível localizar dados nesta tentativa." }
                : line,
            ),
          );
        }
      }

      const overallSuccess = Boolean(consolidatedResult?.brand || consolidatedResult?.model || consolidatedResult?.color);

      setLookupResult({
        plate,
        sources: attemptedSources,
        consolidated: consolidatedResult || {
          brand: null,
          model: null,
          color: null,
          sourceUsedByField: {
            brand: null,
            model: null,
            color: null,
          },
        },
        overallSuccess,
      });

      if (overallSuccess && consolidatedResult) {
        setManualBrand(consolidatedResult.brand || "");
        setManualModel(consolidatedResult.model || "");
        setManualColor(consolidatedResult.color || "");
      } else {
        notify.warning("Não foi possível localizar a placa informada. Preencha os dados manualmente.");
      }
    } finally {
      setLookupLoading(false);
    }
  };
  const onApproveAndSaveVehicle = async () => {
    if (!ownerData?.person?.sequencia) return;
    if (!lookupResult?.plate) {
      notify.warning("Consulte uma placa antes de gravar.");
      return;
    }

    const useLookupData = lookupResult.overallSuccess;
    const brand = (useLookupData ? lookupResult.consolidated.brand : manualBrand).trim();
    const model = (useLookupData ? lookupResult.consolidated.model : manualModel).trim();
    const color = (useLookupData ? lookupResult.consolidated.color : manualColor).trim();

    if (!brand || !model || !color) {
      notify.warning("Preencha marca, modelo e cor para gravar o veículo.");
      return;
    }

    setSavingVehicle(true);
    try {
      await api.vehicleUpsertByPlate({
        plate: lookupResult.plate,
        brand,
        model,
        color,
        ownerSeq: Number(ownerData.person.sequencia),
        unitSeq: selectedUnitSeq ? Number(selectedUnitSeq) : null,
      });

      await refreshVehiclesByOwner(Number(ownerData.person.sequencia));
      setAddModalOpen(false);
      setLookupResult(null);
      setLookupAttemptLines([]);
      setAddPlate("");
      setManualBrand("");
      setManualModel("");
      setManualColor("");
      notify.success("Veículo gravado com sucesso");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao gravar veículo.";
      notify.error("Erro ao salvar veículo", { description: message });
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
      notify.warning("Tag inválida", { description: "Informe 10 dígitos." });
      return;
    }
    if (!validationDevice) {
      notify.warning("Nenhum portão de entrada disponível para validação.");
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
      notify.success("Veículo desvinculado do proprietário");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao desvincular veículo.";
      notify.error("Erro ao desvincular veículo", { description: message });
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
    destructive: "bg-transparent text-status-danger-solid hover:bg-status-danger-soft border-none shadow-none px-2",
  };
  const getCompactButtonClasses = (style: CompactButtonStyle): string => (isWideViewport ? "" : compactButtonClassMap[style]);
  const addVehicleIconOnlyClasses = "h-12 w-12 min-w-[3rem] rounded-full bg-primary text-primary-foreground p-0 shadow-md hover:bg-primary/90 focus-visible:ring-primary";

  return (
    // … 1) Container com max-width e centralizado (evita esticar em ultra-wide)
    <PageContainer>
      <PageHeader title="Veículos" description="Cadastro, tag e desvínculo de veículos por proprietário." />

      <Card>
        <SectionCardHeader title="Buscar Pessoa" description="Digite o CPF para carregar os dados cadastrais." />

        <CardContent className="space-y-3">
          {/* … 2) Input + ação juntos, com largura controlada */}
          <div className="flex items-center gap-2">
            <div className="relative w-full max-w-md">
              {/* Ícone dentro do input (lupa próxima do contexto) */}
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
              className="h-9 w-9 p-0 sm:w-auto sm:px-4"
              aria-label="Buscar Pessoa"
            >
              {loadingOwner ? (
                <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
              ) : (
                <Search className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Buscar</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClearSearch}
              disabled={loadingOwner}
              className="h-9 w-9 p-0 sm:w-auto sm:px-4"
              aria-label="Limpar pesquisa"
            >
              <XCircle className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Limpar</span>
            </Button>
          </div>

          {ownerData?.person ? (
            <div className="typo-body space-y-2">
              <div
                className={`mt-2 min-h-[132px] rounded-md px-3 border  py-2 typo-body ${!ownerAccessMessage && !ownerAccessInfo
                  ? "border-border bg-muted text-muted-foreground"
                  : ownerAccessAllowed
                    ? "state-success-soft border-status-success-solid/40"
                    : "state-danger-soft border-status-danger-solid/40"
                  }`}
              >
                {ownerAccessInfo ? (
                  <>
                    <p className="font-medium">{ownerAccessInfo.NOME?.trim() || "--"}</p>
                    <p>
                      Unidade: {ownerAccessInfo.QUADRA?.trim() || "--"} {ownerAccessInfo.LOTE?.trim() || "--"}
                    </p>
                    <p>Tipo: {ownerAccessInfo.DESCRICAO?.trim() || "--"}</p>
                    <p>Permitido: {(ownerAccessInfo.PERMITIDO || "").trim().toUpperCase() === "S" ? "Sim" : "Não"}</p>
                  </>
                ) : (
                  <p className="pt-2 typo-caption">Consulte um CPF para validar acesso e perfil.</p>
                )}

                {ownerAccessMessage ? (
                  <div className="mt-2 flex items-center gap-2 typo-caption text-current">
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
          title="Veículos"
          description="Gerencie e edite os veículos vinculados."
          action={
            <Button
              type="button"
              onClick={openAddVehicleModal}
              disabled={!hasOwner}
              aria-label="Adicionar veículo"
              className={isWideViewport ? "" : addVehicleIconOnlyClasses}
            >
              <Plus className={`${iconSpacingClass} ${compactIconSizeClass}`} />
              {renderButtonLabel("Adicionar veículo")}
            </Button>
          }
        />

        <CardContent>
          {loadingList ? (
            <div className="flex items-center gap-2 typo-body text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando veículos...
            </div>
          ) : vehicles.length === 0 ? (
            <p className="typo-body text-muted-foreground">Nenhum veículo para exibir.</p>
          ) : (
            <div className="space-y-3">
              {vehicles.map((vehicle) => {
                const hasTag = Boolean((vehicle.TAGVEICULO || "").trim());
                return (
                  // … 3) Item com layout mais “card-like” e responsivo
                  <div key={vehicle.SEQUENCIA} className="rounded-md border p-4 typo-body">
                    <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 ${isWideViewport ? "items-start" : "items-center"}`}>
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
                      <div className={`flex flex-wrap justify-end gap-2 ${isWideViewport ? "items-start" : "items-center"}`}>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => openTagModal(vehicle)}
                          aria-label={hasTag ? "Editar tag" : "Adicionar tag"}
                          className={getCompactButtonClasses("primary") + (isWideViewport ? " self-start" : "")}
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
                          aria-label="Excluir veículo"
                          className={getCompactButtonClasses("destructive") + (isWideViewport ? " self-start" : "")}
                        >
                          {unlinkingVehicleSeq === Number(vehicle.SEQUENCIA) ? (
                            <Loader2 className={`${iconSpacingClass} ${compactIconSizeClass} animate-spin`} />
                          ) : (
                            <Trash2 className={`${iconSpacingClass} ${compactIconSizeClass}`} />
                          )}
                          {renderButtonLabel("Excluir veículo")}
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
            <DialogTitle>Adicionar veículo por placa</DialogTitle>
            <DialogDescription>Executa 3 consultas externas para validar marca, modelo e cor.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* … 4) Campo de placa com largura confortável */}
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

            {lookupAttemptLines.length > 0 ? (
              <div className="space-y-2">
                {lookupAttemptLines.map((line) => (
                  <div
                    key={line.id}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 typo-body ${line.status === "success"
                      ? "state-success-soft border-status-success-solid/40"
                      : line.status === "warning"
                        ? "state-warning-soft border-status-warning-soft-border"
                      : line.status === "error"
                        ? "state-danger-soft border-status-danger-solid/40"
                        : "border-border bg-muted text-muted-foreground"
                      }`}
                  >
                    <span className="flex items-start gap-2">
                      {line.status === "pending" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : line.status === "success" ? (
                        <CheckCircle2 className="h-4 w-4 text-status-success-solid" />
                      ) : line.status === "warning" ? (
                        <AlertTriangle className="h-4 w-4 text-status-warning-soft-foreground" />
                      ) : (
                        <XCircle className="h-4 w-4 text-status-danger-solid" />
                      )}
                      <span className="space-y-1">
                        <span className="block">{line.message}</span>
                        {line.details?.length ? (
                          <span className="block typo-caption space-y-0.5">
                            {line.details.map((detail, index) => (
                              <span key={`${line.id}-detail-${index}`} className="block">{detail}</span>
                            ))}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {lookupResult?.overallSuccess ? (
              <div className="rounded-md border bg-muted p-3 typo-body space-y-1">
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

            {lookupResult && !lookupResult.overallSuccess ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label>Marca</Label>
                  <Input value={manualBrand} onChange={(event) => setManualBrand(event.target.value)} placeholder="Marca" className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label>Modelo</Label>
                  <Input value={manualModel} onChange={(event) => setManualModel(event.target.value)} placeholder="Modelo" className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label>Cor</Label>
                  <Input value={manualColor} onChange={(event) => setManualColor(event.target.value)} placeholder="Cor" className="h-9" />
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)} disabled={savingVehicle}>
              Cancelar
            </Button>
            <Button
              onClick={() => void onApproveAndSaveVehicle()}
              disabled={
                !lookupResult?.plate
                || savingVehicle
                || (!lookupResult.overallSuccess && (!manualBrand.trim() || !manualModel.trim() || !manualColor.trim()))
              }
            >
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
            <DialogDescription>{tagVehicle ? `Veículo ${tagVehicle.PLACA}` : "Informe os dados da tag."}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Numero da tag</Label>
              <Input
                inputMode="numeric"
                value={tagValue}
                onChange={(event) => setTagValue(normalizeDigits(event.target.value))}
                placeholder="10 dígitos"
                className="h-9"
              />
            </div>
            <p className="typo-caption">Validação automática usando o primeiro portão de entrada disponível.</p>
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
            <DialogDescription>Este veículo já possui uma tag. Deseja substituir pela nova tag informada?</DialogDescription>
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
            <DialogTitle>Confirmar exclusão de tag</DialogTitle>
            <DialogDescription>
              {pendingRemoveTagVehicle
                ? `Deseja excluir a tag do veículo ${pendingRemoveTagVehicle.PLACA}?`
                : "Deseja excluir a tag deste veículo?"}
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
            <DialogTitle>Confirmar exclusão de veículo</DialogTitle>
            <DialogDescription>
              {pendingUnlinkVehicle
                ? `Deseja desvincular o veículo ${pendingUnlinkVehicle.PLACA} do proprietário?`
                : "Deseja desvincular este veículo do proprietário?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlinkVehicleConfirmOpen(false)} disabled={Boolean(unlinkingVehicleSeq)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={() => void confirmUnlinkVehicle()} disabled={Boolean(unlinkingVehicleSeq)}>
              {unlinkingVehicleSeq ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Excluir veículo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
