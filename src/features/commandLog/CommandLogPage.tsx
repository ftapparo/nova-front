import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Card from "@mui/material/Card";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { errorMessage } from "@/core/api/http";
import { useRealtimeEvent, useRealtimeFallbackInterval } from "@/core/realtime/useRealtime";
import EmptyState from "@/core/ui/components/EmptyState";
import ErrorState from "@/core/ui/components/ErrorState";
import StatusChip from "@/core/ui/components/StatusChip";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import {
  COMMAND_LOG_LIMITS,
  commandActor,
  commandLabel,
  commandSucceeded,
  commandTarget,
  fetchCommandLogs,
  type CommandLog,
} from "./commandLogApi";

const FALLBACK_REFRESH_MS = 30_000;
const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" });

const formatWhen = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormat.format(date);
};

export default function CommandLogPage() {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState<number>(COMMAND_LOG_LIMITS[0]);
  const [onlyFailures, setOnlyFailures] = useState(false);
  const refetchInterval = useRealtimeFallbackInterval(FALLBACK_REFRESH_MS);
  const key = ["commands", "logs", limit] as const;
  const logs = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchCommandLogs(limit, signal), refetchInterval });

  // Comando novo entra no topo sem recarregar a lista inteira.
  useRealtimeEvent<CommandLog>("command.logged", (entry) => {
    queryClient.setQueryData<CommandLog[]>(key, (current) =>
      current && !current.some((item) => item.id === entry.id) ? [entry, ...current].slice(0, limit) : current,
    );
  });

  const rows = (logs.data ?? []).filter((log) => !onlyFailures || !commandSucceeded(log));

  return (
    <PageContainer>
      <PageHeader
        title="Histórico de comandos"
        subtitle="Comandos enviados a portões, portas, exaustores e à central de incêndio, pelo painel e pelo aplicativo."
        actions={
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <FormControlLabel
              control={<Switch checked={onlyFailures} onChange={(event) => setOnlyFailures(event.target.checked)} />}
              label="Só falhas"
            />
            <TextField select size="small" label="Mostrar" value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
              {COMMAND_LOG_LIMITS.map((value) => (
                <MenuItem key={value} value={value}>
                  Últimos {value}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        }
      />

      {logs.isPending && <LinearProgress aria-label="Carregando o histórico" />}
      {logs.isError && <ErrorState description={errorMessage(logs.error)} onRetry={() => void logs.refetch()} />}
      {logs.isSuccess && rows.length === 0 && <EmptyState title={onlyFailures ? "Nenhuma falha" : "Nenhum comando registrado"} />}

      {rows.length > 0 && (
        <Card>
          <TableContainer>
            <Table size="small" aria-label="Histórico de comandos">
              <TableHead>
                <TableRow>
                  <TableCell>Data e hora</TableCell>
                  <TableCell>Ação</TableCell>
                  <TableCell>Quem</TableCell>
                  <TableCell>Resultado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((log) => {
                  const ok = commandSucceeded(log);
                  const target = commandTarget(log);
                  return (
                    <TableRow key={log.id} hover>
                      <TableCell sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{formatWhen(log.timestamp)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {commandLabel(log)}
                          {target ? ` · ${target}` : ""}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {log.command || `${log.method} ${log.path}`}
                        </Typography>
                      </TableCell>
                      <TableCell>{commandActor(log)}</TableCell>
                      <TableCell>
                        <StatusChip label={ok ? "Concluído" : `Falhou (${log.status})`} tone={ok ? "success" : "error"} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </PageContainer>
  );
}
