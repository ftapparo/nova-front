import { useState, useEffect, type KeyboardEventHandler } from "react";
import { DoorOpen, Warehouse, Loader2, Search, CheckCircle2, AlertTriangle, MoreVertical, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDashboard } from "@/contexts/DashboardContext";
import { humanizeLabel } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { api, type AccessVerifyItem } from "@/services/api";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";

const DEFAULT_GATE_DEVICES = [9, 10];
const STORAGE_KEY = "door-custom-names";
const WIDE_VIEWPORT_MIN_WIDTH = 1480;

export default function ControleAcesso() {
  const { doors, gates, handleOpenDoor, handleOpenGate } = useDashboard();

  const [selectedGate, setSelectedGate] = useState("");
  const [autoClose, setAutoClose] = useState(3);
  const [doorLoadingId, setDoorLoadingId] = useState<string | null>(null);
  const [gateLoading, setGateLoading] = useState(false);
  const [cpf, setCpf] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifiedPerson, setVerifiedPerson] = useState<AccessVerifyItem | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [gateAllowed, setGateAllowed] = useState(false);
  const [customNames, setCustomNames] = useState<Record<string, string>>({});
  const [editingDoor, setEditingDoor] = useState<{ id: string; name: string } | null>(null);
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

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setCustomNames(JSON.parse(stored) as Record<string, string>);
      } catch {
        // Ignorar erro de parse
      }
    }
  }, []);

  const saveCustomName = (doorId: string, customName: string) => {
    const updated = { ...customNames };
    if (customName.trim()) {
      updated[doorId] = customName.trim();
    } else {
      delete updated[doorId];
    }
    setCustomNames(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const openEditDialog = (doorId: string, currentName: string) => {
    setEditingDoor({ id: doorId, name: currentName });
    setEditNameInput(customNames[doorId] || "");
  };

  const closeEditDialog = () => {
    setEditingDoor(null);
    setEditNameInput("");
  };

  const confirmEditName = () => {
    if (editingDoor) {
      saveCustomName(editingDoor.id, editNameInput);
      closeEditDialog();
    }
  };

  const [editNameInput, setEditNameInput] = useState("");
  const sortedDoors = [...(doors || [])].sort((a, b) => humanizeLabel(a.nome).localeCompare(humanizeLabel(b.nome), "pt-BR"));
  const selectedGateItem = (gates || []).find((gate) => String(gate.numeroDispositivo) === selectedGate);

  const sanitizeDigits = (value: string) => value.replace(/\D/g, "");
  const resolveGateSentido = (value: unknown): "E" | "S" => {
    const normalized = String(value ?? "").trim().toUpperCase();
    return normalized === "S" ? "S" : "E";
  };
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

  const resetGateValidation = () => {
    setVerifiedPerson(null);
    setVerifyMessage(null);
    setGateAllowed(false);
  };

  const clearGateFlow = () => {
    setCpf("");
    resetGateValidation();
  };

  const onOpenDoor = async (doorId: string) => {
    setDoorLoadingId(doorId);
    try {
      await handleOpenDoor(doorId);
    } finally {
      setDoorLoadingId(null);
    }
  };

  const onOpenGate = async () => {
    if (!selectedGate || autoClose <= 0 || !gateAllowed) return;
    setGateLoading(true);
    try {
      await handleOpenGate(selectedGate, autoClose);
      const gateSentido = resolveGateSentido(selectedGateItem?.sentido);
      if (verifiedPerson) {
        const registerPayload = {
          dispositivo: Number(selectedGate),
          pessoa: normalizeNumber(verifiedPerson.SEQPESSOA),
          classificacao: normalizeNumber(verifiedPerson.SEQCLASSIFICACAO),
          classAutorizado: normalizeChar(verifiedPerson.CLASSIFAUTORIZADA),
          autorizacaoLanc: normalizeChar(verifiedPerson.AUTORIZACAOLANC),
          origem: normalizeChar(verifiedPerson.TIPO),
          seqIdAcesso: normalizeNumber(verifiedPerson.SEQIDACESSO),
          sentido: gateSentido,
          quadra: normalizeText(verifiedPerson.QUADRA),
          lote: normalizeText(verifiedPerson.LOTE),
          panico: normalizeChar(verifiedPerson.PANICO),
          formaAcesso: "TAG",
          idAcesso: normalizeText(verifiedPerson.IDENT),
          seqVeiculo: normalizeNumber(verifiedPerson.SEQVEICULO),
        };
        try {
          await api.accessRegister(registerPayload);
          notify.success("Acesso registrado", { description: "Registro de entrada realizado com sucesso." });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Falha ao registrar acesso.";
          notify.error("Falha no registro de acesso", { description: message });
        }
      }
    } finally {
      setGateLoading(false);
    }
  };

  const onVerifyCpf = async () => {
    const cpfDigits = sanitizeDigits(cpf);
    if (cpfDigits.length < 11) {
      setVerifyMessage("Informe um CPF válido.");
      setVerifiedPerson(null);
      setGateAllowed(false);
      return;
    }

    setVerifyLoading(true);
    setVerifyMessage(null);

    try {
      const availableDevices = Array.from(
        new Set((gates || []).map((g) => g.numeroDispositivo)),
      );
      let responses: PromiseSettledResult<AccessVerifyItem[]>[] = [];

      if (selectedGate) {
        const gateDevice = Number(selectedGate);
        const gateSentido = resolveGateSentido(selectedGateItem?.sentido);
        responses = await Promise.allSettled([
          api.accessVerify(cpfDigits, gateDevice, gateSentido),
        ]);
      } else {
        const devicesToQuery = availableDevices.length ? availableDevices : DEFAULT_GATE_DEVICES;

        if (!devicesToQuery.length) {
          setVerifyMessage("Nenhum portão disponível para validação.");
          setVerifiedPerson(null);
          setGateAllowed(false);
          return;
        }

        responses = await Promise.allSettled(
          devicesToQuery.map((device) => api.accessVerify(cpfDigits, device, "E")),
        );
      }
      const person = responses
        .filter((response): response is PromiseFulfilledResult<AccessVerifyItem[]> => response.status === "fulfilled")
        .flatMap((response) => response.value || [])[0] ?? null;

      if (!person) {
        setVerifyMessage("Nenhum cadastro encontrado para este CPF.");
        setVerifiedPerson(null);
        setGateAllowed(false);
        return;
      }

      const permitido = (person.PERMITIDO || "").trim().toUpperCase() === "S";
      const perfilValido = ["PROP", "LOC", "MOR"].some((key) => (person[key as "PROP" | "LOC" | "MOR"] || "").trim().toUpperCase() === "S");
      const allowed = permitido && perfilValido;

      setVerifiedPerson(person);
      setGateAllowed(allowed);
      setVerifyMessage(allowed ? "Acesso liberado para abertura do portão." : "Acesso não autorizado para abertura do portão.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao consultar CPF.";
      setVerifyMessage(message);
      setVerifiedPerson(null);
      setGateAllowed(false);
    } finally {
      setVerifyLoading(false);
    }
  };

  const onCpfKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (verifyLoading) return;

    if (event.key === "Enter") {
      event.preventDefault();
      void onVerifyCpf();
      return;
    }

    if (event.key === "Tab") {
      void onVerifyCpf();
    }
  };

  return (
    <PageContainer className={isWideViewport ? "max-w-[90rem]" : "max-w-5xl"}>
      <PageHeader title="Controle de Acesso" description="Gerencie a abertura de portas e portões do condomínio." />

      <div className={isWideViewport ? "grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]" : "grid grid-cols-1 gap-6"}>
        <Card className="h-full min-h-[520px] pb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-primary" />
              <CardTitle>Portas</CardTitle>
            </div>
            <CardDescription>Painel rápido de abertura por porta</CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100%-78px)]">
            <div className="grid h-full auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-3">
              {sortedDoors.map((door) => {
                const doorId = String(door.id);
                const loading = doorLoadingId === doorId;
                const originalName = humanizeLabel(door.nome);
                const customName = customNames[doorId];
                const displayName = customName || originalName;
                return (
                  <div key={door.id} className="group relative h-full">
                    <button
                      type="button"
                      onClick={() => void onOpenDoor(doorId)}
                      disabled={loading || !door.online}
                      className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-2xl bg-primary/10 px-3 text-center transition-colors hover:bg-primary/20 active:bg-primary/25 sm:gap-4 disabled:cursor-not-allowed disabled:opacity-60"
                      title={displayName}
                    >
                      {loading
                        ? <Loader2 className="h-11 w-11 animate-spin text-primary-dark" />
                        : <DoorOpen className="hidden h-11 w-11 text-primary-dark sm:block" />}
                      <div className="flex w-full flex-col items-center gap-1">
                        <span className="line-clamp-2 typo-section-title text-primary-dark">{displayName}</span>
                        {customName ? (
                          <span className="typo-caption line-clamp-1 text-primary-dark/60">{originalName}</span>
                        ) : null}
                      </div>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-2 h-7 w-7 rounded-full bg-background/80 opacity-0 backdrop-blur-sm transition-opacity hover:bg-background group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(doorId, originalName)}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Editar nome
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-primary" />
              <CardTitle>Portões</CardTitle>
            </div>
            <CardDescription>Selecione um portão e configure o fechamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gate-cpf" className="typo-label">CPF</Label>
              <div className="flex items-center gap-2">
                <div className="relative w-full">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="gate-cpf"
                    inputMode="numeric"
                    placeholder="Digite o CPF"
                    value={cpf}
                    onChange={(e) => {
                      setCpf(e.target.value);
                      resetGateValidation();
                    }}
                    onKeyDown={onCpfKeyDown}
                    className="h-9 pl-9 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  onClick={onVerifyCpf}
                  disabled={sanitizeDigits(cpf).length < 11 || verifyLoading}
                  className="h-9 w-9 p-0 sm:w-auto sm:px-4"
                >
                  {verifyLoading ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <Search className="h-4 w-4 sm:mr-2" />}
                  <span className="hidden sm:inline">Buscar</span>
                </Button>
              </div>
            </div>

            <div
              className={`min-h-[132px] rounded-md px-3 py-2 typo-body ${!verifyMessage && !verifiedPerson
                ? "border border-border bg-muted text-muted-foreground"
                : gateAllowed
                  ? "state-success-soft"
                  : "state-danger-soft"
                }`}
            >
              {verifiedPerson ? (
                <>
                  <p className="font-medium">{humanizeLabel(verifiedPerson.NOME)}</p>
                  <p>Unidade: {verifiedPerson.QUADRA?.trim() || "--"} {verifiedPerson.LOTE?.trim() || "--"}</p>
                  <p>Tipo: {humanizeLabel(verifiedPerson.DESCRICAO || "--")}</p>
                  <p>Permitido: {(verifiedPerson.PERMITIDO || "").trim().toUpperCase() === "S" ? "Sim" : "Não"}</p>
                </>
              ) : (
                <p className="pt-2 typo-caption">Insira um CPF e pressione Enter, Tab ou a lupa para validar o acesso.</p>
              )}

              {verifyMessage ? (
                <div className="mt-2 flex items-center gap-2 typo-caption text-current">
                  {gateAllowed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <span>{verifyMessage}</span>
                </div>
              ) : null}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="gate-select" className="typo-label">Portão</Label>
              <Select value={selectedGate} onValueChange={(value) => {
                setSelectedGate(value);
              }}>
                <SelectTrigger id="gate-select" className="h-9 text-sm">
                  <SelectValue placeholder="Selecione um portão" />
                </SelectTrigger>
                <SelectContent>
                  {(gates || []).map((g) => (
                    <SelectItem key={g.id} value={String(g.numeroDispositivo)}>
                      {humanizeLabel(g.nome)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auto-close" className="typo-label">Fechamento automático (segundos)</Label>
              <Input
                id="auto-close"
                type="number"
                min={1}
                value={autoClose}
                onChange={(e) => setAutoClose(Number(e.target.value))}
                className="h-9 text-sm"
              />
              <p className="typo-caption">O portão fechará automaticamente após este tempo</p>
            </div>

            <Button
              onClick={onOpenGate}
              disabled={!selectedGate || autoClose <= 0 || gateLoading || !gateAllowed}
              className="w-full"
              size="lg"
            >
              {gateLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Warehouse className="mr-2 h-4 w-4" />}
              Abrir Portão
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={clearGateFlow}
              disabled={verifyLoading || gateLoading}
              className="w-full bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary active:bg-primary/20"
            >
              Limpar
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingDoor} onOpenChange={(open) => !open && closeEditDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar nome da porta</DialogTitle>
            <DialogDescription>
              Defina um nome personalizado para identificar melhor esta porta. O nome original será exibido abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="edit-name" className="typo-label">Nome personalizado</Label>
            <Input
              id="edit-name"
              value={editNameInput}
              onChange={(e) => setEditNameInput(e.target.value)}
              placeholder={editingDoor?.name || "Digite o nome"}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmEditName();
                }
              }}
              className="h-9"
            />
            <p className="typo-caption">Nome original: {editingDoor?.name}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeEditDialog}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmEditName}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
