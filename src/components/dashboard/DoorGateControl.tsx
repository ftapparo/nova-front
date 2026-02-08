import { useState } from "react";
import { DoorOpen, Warehouse, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { DoorItem, GateItem } from "@/services/api";

interface Props {
  doors: DoorItem[];
  gates: GateItem[];
  onOpenDoor: (id: string) => Promise<void>;
  onOpenGate: (id: string, autoClose: number) => Promise<void>;
}

export default function DoorGateControl({ doors, gates, onOpenDoor, onOpenGate }: Props) {
  const [selectedDoor, setSelectedDoor] = useState("");
  const [selectedGate, setSelectedGate] = useState("");
  const [autoClose, setAutoClose] = useState(15);
  const [doorLoading, setDoorLoading] = useState(false);
  const [gateLoading, setGateLoading] = useState(false);

  const handleOpenDoor = async () => {
    if (!selectedDoor) return;
    setDoorLoading(true);
    try { await onOpenDoor(selectedDoor); } finally { setDoorLoading(false); }
  };

  const handleOpenGate = async () => {
    if (!selectedGate || autoClose <= 0) return;
    setGateLoading(true);
    try { await onOpenGate(selectedGate, autoClose); } finally { setGateLoading(false); }
  };

  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm space-y-5">
      <h2 className="text-lg font-semibold text-card-foreground">Controle de Portas e Portões</h2>

      {/* Doors */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <DoorOpen className="h-4 w-4 text-primary" /> Portas
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label htmlFor="door-select" className="sr-only">Porta</Label>
            <Select value={selectedDoor} onValueChange={setSelectedDoor}>
              <SelectTrigger id="door-select"><SelectValue placeholder="Selecione uma porta" /></SelectTrigger>
              <SelectContent>
                {doors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleOpenDoor} disabled={!selectedDoor || doorLoading}>
            {doorLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Abrir Porta
          </Button>
        </div>
      </div>

      <Separator />

      {/* Gates */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Warehouse className="h-4 w-4 text-secondary" /> Portões
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Label htmlFor="gate-select" className="sr-only">Portão</Label>
            <Select value={selectedGate} onValueChange={setSelectedGate}>
              <SelectTrigger id="gate-select"><SelectValue placeholder="Selecione um portão" /></SelectTrigger>
              <SelectContent>
                {gates.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-32">
            <Label htmlFor="auto-close" className="text-xs text-muted-foreground">Fechamento (s)</Label>
            <Input
              id="auto-close"
              type="number"
              min={1}
              value={autoClose}
              onChange={(e) => setAutoClose(Number(e.target.value))}
            />
          </div>
          <Button variant="secondary" onClick={handleOpenGate} disabled={!selectedGate || autoClose <= 0 || gateLoading} className="self-end">
            {gateLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Abrir Portão
          </Button>
        </div>
      </div>
    </div>
  );
}
