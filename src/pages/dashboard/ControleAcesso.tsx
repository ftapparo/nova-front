import { useState } from "react";
import { DoorOpen, Warehouse, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDashboard } from "@/contexts/DashboardContext";

export default function ControleAcesso() {
  const { doors, gates, handleOpenDoor, handleOpenGate } = useDashboard();
  
  const [selectedDoor, setSelectedDoor] = useState("");
  const [selectedGate, setSelectedGate] = useState("");
  const [autoClose, setAutoClose] = useState(15);
  const [doorLoading, setDoorLoading] = useState(false);
  const [gateLoading, setGateLoading] = useState(false);

  const onOpenDoor = async () => {
    if (!selectedDoor) return;
    setDoorLoading(true);
    try { await handleOpenDoor(selectedDoor); } finally { setDoorLoading(false); }
  };

  const onOpenGate = async () => {
    if (!selectedGate || autoClose <= 0) return;
    setGateLoading(true);
    try { await handleOpenGate(selectedGate, autoClose); } finally { setGateLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Controle de Acesso</h1>
        <p className="text-muted-foreground">Gerencie a abertura de portas e portões do condomínio.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Doors Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DoorOpen className="h-5 w-5 text-primary" />
              <CardTitle>Portas</CardTitle>
            </div>
            <CardDescription>Selecione uma porta para abrir</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="door-select">Porta</Label>
              <Select value={selectedDoor} onValueChange={setSelectedDoor}>
                <SelectTrigger id="door-select">
                  <SelectValue placeholder="Selecione uma porta" />
                </SelectTrigger>
                <SelectContent>
                  {(doors || []).filter(d => d.ativo === "S").map((d) => (
                    <SelectItem key={d.sequencia} value={String(d.sequencia)}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={onOpenDoor} 
              disabled={!selectedDoor || doorLoading}
              className="w-full"
              size="lg"
            >
              {doorLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DoorOpen className="h-4 w-4 mr-2" />}
              Abrir Porta
            </Button>
          </CardContent>
        </Card>

        {/* Gates Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Warehouse className="h-5 w-5 text-secondary" />
              <CardTitle>Portões</CardTitle>
            </div>
            <CardDescription>Selecione um portão e configure o fechamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gate-select">Portão</Label>
              <Select value={selectedGate} onValueChange={setSelectedGate}>
                <SelectTrigger id="gate-select">
                  <SelectValue placeholder="Selecione um portão" />
                </SelectTrigger>
                <SelectContent>
                  {(gates || []).filter(g => g.ativo === "S").map((g) => (
                    <SelectItem key={g.sequencia} value={String(g.sequencia)}>
                      {g.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Label htmlFor="auto-close">Fechamento automático (segundos)</Label>
              <Input
                id="auto-close"
                type="number"
                min={1}
                value={autoClose}
                onChange={(e) => setAutoClose(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                O portão fechará automaticamente após este tempo
              </p>
            </div>

            <Button 
              variant="secondary"
              onClick={onOpenGate} 
              disabled={!selectedGate || autoClose <= 0 || gateLoading}
              className="w-full"
              size="lg"
            >
              {gateLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Warehouse className="h-4 w-4 mr-2" />}
              Abrir Portão
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
