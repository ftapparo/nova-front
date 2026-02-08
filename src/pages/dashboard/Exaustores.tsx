import { useState } from "react";
import { Fan, Loader2, Search, Power, PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useDashboard } from "@/contexts/DashboardContext";

const BLOCKS = ["A", "B", "C"];

export default function Exaustores() {
  const { handleExhaustOn, handleExhaustOff, handleExhaustStatus } = useDashboard();
  
  const [block, setBlock] = useState("");
  const [apartment, setApartment] = useState("");
  const [duration, setDuration] = useState(30);
  const [onLoading, setOnLoading] = useState(false);
  const [offLoading, setOffLoading] = useState(false);

  const [statusId, setStatusId] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusResult, setStatusResult] = useState<string | null>(null);

  const valid = block && apartment.trim();

  const onTurnOn = async () => {
    if (!valid || duration <= 0) return;
    setOnLoading(true);
    try { await handleExhaustOn(block, apartment.trim(), duration); } finally { setOnLoading(false); }
  };

  const onTurnOff = async () => {
    if (!valid) return;
    setOffLoading(true);
    try { await handleExhaustOff(block, apartment.trim()); } finally { setOffLoading(false); }
  };

  const onCheckStatus = async () => {
    if (!statusId.trim()) return;
    setStatusLoading(true);
    setStatusResult(null);
    try {
      const data = await handleExhaustStatus(statusId.trim());
      setStatusResult(JSON.stringify(data, null, 2));
    } catch (err: unknown) {
      setStatusResult(`Erro: ${err instanceof Error ? err.message : "Desconhecido"}`);
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Controle de Exaustores</h1>
        <p className="text-muted-foreground">Gerencie os exaustores das áreas comuns por bloco e apartamento.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Control Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Fan className="h-5 w-5 text-primary" />
              <CardTitle>Controle</CardTitle>
            </div>
            <CardDescription>Ligar ou desligar exaustor por localização</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ex-block">Bloco</Label>
                <Select value={block} onValueChange={setBlock}>
                  <SelectTrigger id="ex-block">
                    <SelectValue placeholder="Bloco" />
                  </SelectTrigger>
                  <SelectContent>
                    {BLOCKS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ex-apt">Apartamento</Label>
                <Input 
                  id="ex-apt" 
                  placeholder="Ex: 101" 
                  value={apartment} 
                  onChange={(e) => setApartment(e.target.value)} 
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="ex-dur">Tempo de funcionamento (minutos)</Label>
              <Input 
                id="ex-dur" 
                type="number" 
                min={1} 
                value={duration} 
                onChange={(e) => setDuration(Number(e.target.value))} 
              />
              <p className="text-xs text-muted-foreground">
                O exaustor desligará automaticamente após este tempo
              </p>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={onTurnOn} 
                disabled={!valid || duration <= 0 || onLoading}
                className="flex-1"
                size="lg"
              >
                {onLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Power className="h-4 w-4 mr-2" />}
                Ligar
              </Button>
              <Button 
                variant="outline" 
                onClick={onTurnOff} 
                disabled={!valid || offLoading}
                className="flex-1"
                size="lg"
              >
                {offLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PowerOff className="h-4 w-4 mr-2" />}
                Desligar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Consultar Status</CardTitle>
            </div>
            <CardDescription>Verifique o status de um exaustor específico</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status-id">ID do Exaustor</Label>
              <Input 
                id="status-id" 
                placeholder="Ex: A1" 
                value={statusId} 
                onChange={(e) => setStatusId(e.target.value)} 
              />
              <p className="text-xs text-muted-foreground">
                Digite o identificador do exaustor (Bloco + Número)
              </p>
            </div>

            <Button 
              variant="outline" 
              onClick={onCheckStatus} 
              disabled={!statusId.trim() || statusLoading}
              className="w-full"
            >
              {statusLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Consultar Status
            </Button>

            {statusResult && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Resposta da API</Label>
                <pre className="rounded-lg bg-foreground text-primary-foreground p-4 text-xs overflow-auto max-h-48 font-mono">
                  {statusResult}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
