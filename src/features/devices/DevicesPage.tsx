import { useEffect, useRef, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { errorMessage } from "@/core/api/http";
import { useRealtimeEvent, useRealtimeFallbackInterval } from "@/core/realtime/useRealtime";
import ErrorState from "@/core/ui/components/ErrorState";
import SectionCard from "@/core/ui/components/SectionCard";
import StatusChip from "@/core/ui/components/StatusChip";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import { exhaustsQuery, groupExhaustModules } from "@/features/exhaust/exhaustApi";
import { panelQuery } from "@/features/fire/fireApi";
import { doorsListQuery, doorsStatusQuery, gatesListQuery, gatesStatusQuery } from "@/features/gates/gatesApi";

const FALLBACK_REFRESH_MS = 30_000;
const INVALIDATE_DEBOUNCE_MS = 500;
const timeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

interface DeviceRow {
  key: string | number;
  name: string;
  detail?: string;
  /** null = ainda não sondado. */
  online: boolean | null;
}

function OnlineChip({ online }: { online: boolean | null }) {
  if (online === null) return <StatusChip label="Sem leitura" tone="neutral" />;
  return <StatusChip label={online ? "Online" : "Sem comunicação"} tone={online ? "success" : "error"} />;
}

function DeviceSection({
  title,
  rows,
  pending,
  error,
  onRetry,
  checkedAt,
}: {
  title: string;
  rows: DeviceRow[];
  pending: boolean;
  error: unknown;
  onRetry: () => void;
  checkedAt?: string | null;
}) {
  const offline = rows.filter((row) => row.online === false).length;
  const subtitle = pending
    ? undefined
    : `${rows.length - offline} de ${rows.length} com comunicação${checkedAt ? ` · verificado em ${timeFormat.format(new Date(checkedAt))}` : ""}`;

  let body: ReactNode;
  if (pending) body = <LinearProgress aria-label={`Carregando ${title}`} />;
  else if (error) body = <ErrorState description={errorMessage(error)} onRetry={onRetry} />;
  else
    body = (
      <List disablePadding aria-label={title}>
        {rows.map((row) => (
          <ListItem key={row.key} divider disableGutters secondaryAction={<OnlineChip online={row.online} />}>
            <ListItemText primary={row.name} secondary={row.detail} sx={{ pr: 16 }} />
          </ListItem>
        ))}
      </List>
    );

  return (
    <SectionCard title={title} subtitle={subtitle} action={offline > 0 ? <StatusChip label={`${offline} fora do ar`} tone="error" /> : undefined}>
      {body}
    </SectionCard>
  );
}

/**
 * Comunicação de todos os equipamentos com a API. Qualquer aviso de mudança
 * (status, exaustor, central, serviço por trás da API) recarrega as consultas.
 */
export default function DevicesPage() {
  const queryClient = useQueryClient();
  const refetchInterval = useRealtimeFallbackInterval(FALLBACK_REFRESH_MS);
  const gates = useQuery(gatesListQuery);
  const gatesStatus = useQuery({ ...gatesStatusQuery, refetchInterval });
  const doors = useQuery(doorsListQuery);
  const doorsStatus = useQuery({ ...doorsStatusQuery, refetchInterval });
  const exhausts = useQuery({ ...exhaustsQuery, refetchInterval });
  const panel = useQuery({ ...panelQuery, refetchInterval });

  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const refresh = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      for (const key of [gatesStatusQuery.queryKey, doorsStatusQuery.queryKey, exhaustsQuery.queryKey, panelQuery.queryKey]) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
    }, INVALIDATE_DEBOUNCE_MS);
  };
  useRealtimeEvent("devices.status.changed", refresh);
  useRealtimeEvent("exhaust.changed", refresh);
  useRealtimeEvent("cie.connection.changed", refresh);
  useRealtimeEvent("upstream.connection.changed", refresh);

  const gateOnline = new Map(gatesStatus.data?.gates.map((gate) => [gate.numeroDispositivo, gate.online]));
  const gateRows: DeviceRow[] = (gates.data ?? [])
    .filter((gate) => gate.ativo)
    .map((gate) => ({
      key: gate.numeroDispositivo,
      name: gate.nome,
      detail: `Portão · dispositivo ${gate.numeroDispositivo}`,
      online: gateOnline.get(gate.numeroDispositivo) ?? null,
    }));

  const doorOnline = new Map(doorsStatus.data?.doors.map((door) => [door.id, door.online]));
  const doorRows: DeviceRow[] = (doors.data ?? [])
    .filter((door) => door.ativo)
    .map((door) => ({ key: door.id, name: door.nome, detail: "Porta de pedestre", online: doorOnline.get(door.id) ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const moduleRows: DeviceRow[] = groupExhaustModules(exhausts.data ?? []).map((module) => ({
    key: module.id,
    name: module.id,
    detail: `${module.label} · exaustores ${module.exhaustIds.join(", ")}`,
    online: module.online,
  }));

  const fireRows: DeviceRow[] = panel.data
    ? [
        {
          key: "cie",
          name: [panel.data.central.nome, panel.data.central.modelo].filter(Boolean).join(" · ") || "Central de incêndio",
          detail: panel.data.restarting ? "Reiniciando" : panel.data.situation.label,
          online: panel.data.online && panel.data.connected,
        },
      ]
    : [];

  return (
    <PageContainer>
      <PageHeader title="Equipamentos" subtitle="Comunicação de portões, portas, exaustores e central de incêndio com a API." />
      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" } }}>
        <DeviceSection
          title="Portões"
          rows={gateRows}
          pending={gates.isPending || gatesStatus.isPending}
          error={gates.error ?? gatesStatus.error}
          onRetry={() => {
            void gates.refetch();
            void gatesStatus.refetch();
          }}
          checkedAt={gatesStatus.data?.updatedAt}
        />
        <DeviceSection
          title="Portas"
          rows={doorRows}
          pending={doors.isPending || doorsStatus.isPending}
          error={doors.error ?? doorsStatus.error}
          onRetry={() => {
            void doors.refetch();
            void doorsStatus.refetch();
          }}
          checkedAt={doorsStatus.data?.updatedAt}
        />
        <DeviceSection
          title="Módulos de exaustores"
          rows={moduleRows}
          pending={exhausts.isPending}
          error={exhausts.error}
          onRetry={() => void exhausts.refetch()}
        />
        <Stack spacing={3}>
          <DeviceSection
            title="Central de incêndio"
            rows={fireRows}
            pending={panel.isPending}
            error={panel.error}
            onRetry={() => void panel.refetch()}
          />
          <Typography variant="caption" color="textSecondary">
            Portões e portas são sondados pela API a cada minuto; exaustores e central, a cada comando e evento.
          </Typography>
        </Stack>
      </Box>
    </PageContainer>
  );
}
