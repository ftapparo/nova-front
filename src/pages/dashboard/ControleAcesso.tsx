import { useState, type KeyboardEventHandler } from "react";
import { DoorOpen, Warehouse, Loader2, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDashboard } from "@/contexts/DashboardContext";
import { humanizeLabel } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { api, type AccessVerifyItem } from "@/services/api";

const DEFAULT_GATE_DEVICES = [9, 10];

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
  const sortedDoors = [...(doors || [])].sort((a, b) => humanizeLabel(a.nome).localeCompare(humanizeLabel(b.nome), "pt-BR"));

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
      if (verifiedPerson) {
        const registerPayload = {
          dispositivo: Number(selectedGate),
          pessoa: normalizeNumber(verifiedPerson.SEQPESSOA),
          classificacao: normalizeNumber(verifiedPerson.SEQCLASSIFICACAO),
          classAutorizado: normalizeChar(verifiedPerson.CLASSIFAUTORIZADA),
          autorizacaoLanc: normalizeChar(verifiedPerson.AUTORIZACAOLANC),
          origem: normalizeChar(verifiedPerson.TIPO),
          seqIdAcesso: normalizeNumber(verifiedPerson.SEQIDACESSO),
          sentido: "E",
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
      setVerifyMessage("Informe um CPF valido.");
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
      const devicesToQuery = selectedGate
        ? [Number(selectedGate)]
        : (availableDevices.length ? availableDevices : DEFAULT_GATE_DEVICES);

      if (!devicesToQuery.length) {
        setVerifyMessage("Nenhum portao disponivel para validacao.");
        setVerifiedPerson(null);
        setGateAllowed(false);
        return;
      }

      const responses = await Promise.allSettled(
        devicesToQuery.map((device) => api.accessVerify(cpfDigits, device, "E")),
      );
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
      setVerifyMessage(allowed ? "Acesso liberado para abertura do portao." : "Acesso nao autorizado para abertura do portao.");
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Controle de Acesso</h1>
        <p className="text-muted-foreground">Gerencie a abertura de portas e portoes do condominio.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="h-full min-h-[520px] pb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Portas</CardTitle>
            </div>
            <CardDescription className="text-xs">Painel rápido de abertura por porta</CardDescription>
          </CardHeader>
          <CardContent className="h-[calc(100%-78px)]">
            <div className="grid h-full auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-3">
              {sortedDoors.map((door) => {
                const doorId = String(door.id);
                const loading = doorLoadingId === doorId;
                return (
                  <button
                    key={door.id}
                    type="button"
                    onClick={() => void onOpenDoor(doorId)}
                    disabled={loading || !door.online}
                    className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-2xl border bg-white px-3 text-center transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    title={humanizeLabel(door.nome)}
                  >
                    {loading ? <Loader2 className="h-9 w-9 animate-spin text-slate-700" /> : <DoorOpen className="h-9 w-9 text-slate-700" />}
                    <span className="line-clamp-2 text-lg font-bold leading-tight text-slate-800">{humanizeLabel(door.nome)}</span>
                    <span className={`text-base font-semibold ${door.online ? "text-emerald-700" : "text-rose-700"}`}>
                      {door.online ? "Online" : "Offline"}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-secondary" />
              <CardTitle className="text-base font-semibold">Portoes</CardTitle>
            </div>
            <CardDescription className="text-xs">Selecione um portao e configure o fechamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gate-cpf" className="text-xs">CPF</Label>
              <div className="flex gap-2">
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
                  className="h-9 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onVerifyCpf}
                  disabled={sanitizeDigits(cpf).length < 11 || verifyLoading}
                  className="h-9 px-3"
                >
                  {verifyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div
              className={`min-h-[132px] rounded-md border px-3 py-2 text-sm ${
                !verifyMessage && !verifiedPerson
                  ? "border-slate-200 bg-slate-100 text-slate-700"
                  : gateAllowed
                    ? "border-emerald-200 bg-emerald-100 text-emerald-900"
                    : "border-rose-200 bg-rose-100 text-rose-900"
              }`}
            >
              {verifiedPerson ? (
                <>
                  <p className="font-medium">{humanizeLabel(verifiedPerson.NOME)}</p>
                  <p>Unidade: {verifiedPerson.QUADRA?.trim() || "--"} {verifiedPerson.LOTE?.trim() || "--"}</p>
                  <p>Tipo: {humanizeLabel(verifiedPerson.DESCRICAO || "--")}</p>
                  <p>Permitido: {(verifiedPerson.PERMITIDO || "").trim().toUpperCase() === "S" ? "Sim" : "Nao"}</p>
                </>
              ) : (
                <p className="pt-2 text-xs">Insira um CPF e pressione Enter, Tab ou a lupa para validar o acesso.</p>
              )}

              {verifyMessage ? (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  {gateAllowed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  <span>{verifyMessage}</span>
                </div>
              ) : null}
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="gate-select" className="text-xs">Portao</Label>
              <Select value={selectedGate} onValueChange={(value) => {
                setSelectedGate(value);
              }}>
                <SelectTrigger id="gate-select" className="h-9 text-sm">
                  <SelectValue placeholder="Selecione um portao" />
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
              <Label htmlFor="auto-close" className="text-xs">Fechamento automatico (segundos)</Label>
              <Input
                id="auto-close"
                type="number"
                min={1}
                value={autoClose}
                onChange={(e) => setAutoClose(Number(e.target.value))}
                className="h-9 text-sm"
              />
              <p className="text-xs text-muted-foreground">O portao fechara automaticamente apos este tempo</p>
            </div>

            <Button
              variant="secondary"
              onClick={onOpenGate}
              disabled={!selectedGate || autoClose <= 0 || gateLoading || !gateAllowed}
              className="w-full"
              size="lg"
            >
              {gateLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Warehouse className="mr-2 h-4 w-4" />}
              Abrir Portao
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={clearGateFlow}
              disabled={verifyLoading || gateLoading}
              className="w-full"
            >
              Limpar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
