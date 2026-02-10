import { useState } from "react";
import { Fan, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ExhaustRunningStatus } from "@/contexts/DashboardContext";
import { humanizeLabel } from "@/lib/utils";

interface Props {
  onTurnOn: (block: string, apartment: string, duration: number) => Promise<void>;
  onTurnOff: (block: string, apartment: string) => Promise<void>;
  onStatus: (id: string) => Promise<ExhaustRunningStatus>;
}

const BLOCKS = ["A", "B", "C"];

export default function ExhaustControl({ onTurnOn, onTurnOff, onStatus }: Props) {
  const [block, setBlock] = useState("");
  const [apartment, setApartment] = useState("");
  const [duration, setDuration] = useState(30);
  const [onLoading, setOnLoading] = useState(false);
  const [offLoading, setOffLoading] = useState(false);

  const [statusId, setStatusId] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusResult, setStatusResult] = useState<ExhaustRunningStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const valid = block && apartment.trim();

  const handleOn = async () => {
    if (!valid || duration <= 0) return;
    setOnLoading(true);
    try { await onTurnOn(block, apartment.trim(), duration); } finally { setOnLoading(false); }
  };

  const handleOff = async () => {
    if (!valid) return;
    setOffLoading(true);
    try { await onTurnOff(block, apartment.trim()); } finally { setOffLoading(false); }
  };

  const handleStatus = async () => {
    if (!statusId.trim()) return;
    setStatusLoading(true);
    setStatusResult(null);
    setStatusError(null);
    try {
      const data = await onStatus(statusId.trim());
      setStatusResult(data);
    } catch (err: unknown) {
      setStatusError(`Erro: ${err instanceof Error ? err.message : "Desconhecido"}`);
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm space-y-5">
      <div className="flex items-center gap-2">
        <Fan className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-card-foreground">Controle de Exaustores</h2>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="ex-block">Bloco</Label>
          <Select value={block} onValueChange={setBlock}>
            <SelectTrigger id="ex-block"><SelectValue placeholder="Bloco" /></SelectTrigger>
            <SelectContent>
              {BLOCKS.map((b) => <SelectItem key={b} value={b}>{humanizeLabel(b)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ex-apt">Apartamento</Label>
          <Input id="ex-apt" placeholder="Ex: 101" value={apartment} onChange={(e) => setApartment(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ex-dur">Tempo (min)</Label>
          <Input id="ex-dur" type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={handleOn} disabled={!valid || duration <= 0 || onLoading}>
          {onLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          Ligar Exaustor
        </Button>
        <Button variant="outline" onClick={handleOff} disabled={!valid || offLoading}>
          {offLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
          Desligar Exaustor
        </Button>
      </div>

      {/* Status query */}
      <div className="border-t pt-4 space-y-3">
        <p className="text-sm font-medium text-muted-foreground">Consultar Status</p>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label htmlFor="status-id" className="sr-only">ID do exaustor</Label>
            <Input id="status-id" placeholder="Ex: A1" value={statusId} onChange={(e) => setStatusId(e.target.value)} />
          </div>
          <Button variant="outline" onClick={handleStatus} disabled={!statusId.trim() || statusLoading}>
            {statusLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
            Consultar
          </Button>
        </div>
        {statusError && <p className="text-sm text-destructive">{statusError}</p>}
        {statusResult && (
          <div className="rounded-md border bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Exaustor {statusResult.id}</p>
              <Badge variant={statusResult.isRunning ? "default" : "secondary"}>
                {statusResult.isRunning ? "Em funcionamento" : "Desligado"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Tempo restante: {statusResult.remainingMinutes ? `${statusResult.remainingMinutes} min` : "--"}
            </p>
            <p className="text-xs text-muted-foreground">
              Atualizado em: {new Date(statusResult.generatedAt).toLocaleString("pt-BR")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
