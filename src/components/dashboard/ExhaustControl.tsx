import { useState } from "react";
import { Fan, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  onTurnOn: (block: string, apartment: string, duration: number) => Promise<void>;
  onTurnOff: (block: string, apartment: string) => Promise<void>;
  onStatus: (id: string) => Promise<unknown>;
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
  const [statusResult, setStatusResult] = useState<string | null>(null);

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
    try {
      const data = await onStatus(statusId.trim());
      setStatusResult(JSON.stringify(data, null, 2));
    } catch (err: unknown) {
      setStatusResult(`Erro: ${err instanceof Error ? err.message : "Desconhecido"}`);
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
              {BLOCKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
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
        {statusResult && (
          <pre className="rounded-md bg-foreground/95 text-primary-foreground p-4 text-xs overflow-auto max-h-48 font-mono">
            {statusResult}
          </pre>
        )}
      </div>
    </div>
  );
}
