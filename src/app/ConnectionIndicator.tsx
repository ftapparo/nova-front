import Tooltip from "@mui/material/Tooltip";
import { useRealtimeStatus } from "@/core/realtime/useRealtime";
import type { UpstreamOutage } from "@/core/realtime/realtime";
import StatusChip from "@/core/ui/components/StatusChip";

const describeOutage = ({ service, numeroDispositivo }: UpstreamOutage): string => {
  if (service === "cie") return "Central de incêndio sem comunicação";
  if (service === "tag") return numeroDispositivo === null ? "Portões sem comunicação" : `Portão ${numeroDispositivo} sem comunicação`;
  return `Serviço ${service} sem comunicação`;
};

/** Situação do tempo real na barra superior. */
export default function ConnectionIndicator() {
  const { state, outages } = useRealtimeStatus();

  if (state === "idle") return null;

  if (state !== "open") {
    return (
      <Tooltip title="Sem atualização automática no momento. As telas consultam o servidor periodicamente até reconectar.">
        <span>
          <StatusChip label={state === "connecting" ? "Conectando…" : "Reconectando…"} tone="warning" />
        </span>
      </Tooltip>
    );
  }

  if (outages.length > 0) {
    return (
      <Tooltip title={outages.map(describeOutage).join(" · ")}>
        <span>
          <StatusChip label="Dados podem estar desatualizados" tone="warning" />
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip title="Atualização automática ativa.">
      <span>
        <StatusChip label="Tempo real" tone="success" />
      </span>
    </Tooltip>
  );
}
