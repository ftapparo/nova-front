import { RefreshCw, DoorOpen, Warehouse, Fan, Info, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/contexts/DashboardContext";

export default function PainelOperacional() {
  const { doors, gates, lastAction, apiError, loadDevices, refreshing } = useDashboard();

  const activeDoors = doors.filter(d => d.ativo === "S").length;
  const activeGates = gates.filter(g => g.ativo === "S").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Operacional</h1>
          <p className="text-muted-foreground">Visão geral do status dos dispositivos do condomínio.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDevices} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portas</CardTitle>
            <DoorOpen className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDoors}/{doors.length}</div>
            <p className="text-xs text-muted-foreground">portas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Portões</CardTitle>
            <Warehouse className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeGates}/{gates.length}</div>
            <p className="text-xs text-muted-foreground">portões ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exaustores</CardTitle>
            <Fan className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground">consulte por ID</p>
          </CardContent>
        </Card>
      </div>

      {/* Device List */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status das Portas</CardTitle>
            <CardDescription>Lista de portas cadastradas no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {doors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma porta cadastrada.</p>
            ) : (
              <div className="space-y-2">
                {doors.map((door) => (
                  <div key={door.sequencia} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm font-medium">{door.nome}</span>
                    <div className="flex items-center gap-2">
                      {door.ativo === "S" ? (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <CheckCircle2 className="h-3 w-3" /> Ativa
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <XCircle className="h-3 w-3" /> Inativa
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status dos Portões</CardTitle>
            <CardDescription>Lista de portões cadastrados no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            {gates.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum portão cadastrado.</p>
            ) : (
              <div className="space-y-2">
                {gates.map((gate) => (
                  <div key={gate.sequencia} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <span className="text-sm font-medium">{gate.nome}</span>
                    <div className="flex items-center gap-2">
                      {gate.ativo === "S" ? (
                        <span className="flex items-center gap-1 text-xs text-success">
                          <CheckCircle2 className="h-3 w-3" /> Ativo
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <XCircle className="h-3 w-3" /> Inativo
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {lastAction && (
        <div className="flex items-start gap-3 rounded-lg border border-secondary/30 bg-secondary/10 p-4">
          <Info className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-secondary">Última operação</p>
            <p className="text-sm text-secondary/80">{lastAction}</p>
          </div>
        </div>
      )}

      {apiError && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">Erro</p>
            <p className="text-sm text-destructive/80">{apiError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
