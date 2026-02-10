import { RefreshCw, DoorOpen, Warehouse, Info, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  doorCount: number;
  gateCount: number;
  lastAction: string | null;
  apiError: string | null;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function OperationalPanel({ doorCount, gateCount, lastAction, apiError, onRefresh, refreshing }: Props) {
  return (
    <div className="rounded-lg border bg-card p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground">Painel Operacional</h2>
          <p className="text-sm text-muted-foreground">Controle de portas, portões e exaustores da área comum.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="text-primary hover:bg-primary/10 hover:text-primary active:bg-primary/15"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Indicators */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-medium">
          <DoorOpen className="h-4 w-4 text-primary" />
          <span>{doorCount} porta{doorCount !== 1 ? "s" : ""} ativa{doorCount !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-medium">
          <Warehouse className="h-4 w-4 text-primary" />
          <span>{gateCount} portão{gateCount !== 1 ? "ões" : ""} ativo{gateCount !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Alerts */}
      {lastAction && (
        <div className="flex items-start gap-2 rounded-md bg-primary/10 p-3 text-sm text-primary">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{lastAction}</span>
        </div>
      )}
      {apiError && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}
    </div>
  );
}
