import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { errorMessage } from "@/core/api/http";
import { erpText, joinErpText } from "@/core/format/erpText";
import ConfirmDialog from "@/core/ui/components/ConfirmDialog";
import EmptyState from "@/core/ui/components/EmptyState";
import ErrorState from "@/core/ui/components/ErrorState";
import SectionCard from "@/core/ui/components/SectionCard";
import StatusChip from "@/core/ui/components/StatusChip";
import { useNotify } from "@/core/ui/components/useNotify";
import {
  clearTagCache,
  fetchTagCache,
  removeTagFromCache,
  type Gate,
  type TagCacheFilter,
  type TagCacheItem,
} from "@/features/gates/gatesApi";

const FILTERS: { value: TagCacheFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "positive", label: "Liberadas" },
  { value: "negative", label: "Recusadas" },
];
const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeStyle: "medium" });
const minutes = (ms: number) => `${Math.round(ms / 60_000)} min`;

interface TagCacheCardProps {
  gates: Gate[];
  /** Síndico/admin: remover uma TAG e limpar o cache. */
  canManage: boolean;
}

/** TAGs guardadas por cada antena, com quem é cada uma (dado de morador, só em memória). */
export default function TagCacheCard({ gates, canManage }: TagCacheCardProps) {
  const notify = useNotify();
  const [gateNumber, setGateNumber] = useState<number | "">(gates[0]?.numeroDispositivo ?? "");
  const [filter, setFilter] = useState<TagCacheFilter>("all");
  const [confirm, setConfirm] = useState<{ kind: "clear" } | { kind: "remove"; item: TagCacheItem } | null>(null);
  const gate = gates.find((item) => item.numeroDispositivo === gateNumber) ?? null;

  const cache = useQuery({
    queryKey: ["tag-cache", gateNumber, filter],
    queryFn: ({ signal }) => fetchTagCache(Number(gateNumber), filter, signal),
    enabled: gateNumber !== "",
    // Dado de morador: sai da memória assim que a tela deixa de usá-lo.
    gcTime: 0,
  });

  const done = (message: string) => {
    notify.success(message);
    setConfirm(null);
    void cache.refetch();
  };
  const clear = useMutation({
    mutationFn: () => clearTagCache(Number(gateNumber), filter),
    onSuccess: () => done("Cache limpo."),
    onError: (error) => notify.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (item: TagCacheItem) => removeTagFromCache(Number(gateNumber), item.tag),
    onSuccess: (_data, item) => done(`TAG ${item.tag} removida do cache.`),
    onError: (error) => notify.error(errorMessage(error)),
  });

  const stats = cache.data?.stats;

  return (
    <SectionCard
      title="Cache de TAGs"
      subtitle={
        stats
          ? `${stats.positiveSize} liberada(s) por ${minutes(stats.positiveTimeout)} · ${stats.negativeSize} recusada(s) por ${minutes(stats.negativeTimeout)}`
          : "TAGs já conferidas que a antena guarda por alguns minutos."
      }
      action={
        canManage && (
          <Button color="error" disabled={!cache.isSuccess || cache.data.items.length === 0} onClick={() => setConfirm({ kind: "clear" })}>
            Limpar cache
          </Button>
        )
      }
    >
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField select size="small" label="Portão" value={gateNumber} onChange={(event) => setGateNumber(Number(event.target.value))} sx={{ minWidth: 200 }}>
          {gates.map((item) => (
            <MenuItem key={item.numeroDispositivo} value={item.numeroDispositivo}>
              {item.nome}
            </MenuItem>
          ))}
        </TextField>
        <TextField select size="small" label="Mostrar" value={filter} onChange={(event) => setFilter(event.target.value as TagCacheFilter)} sx={{ minWidth: 160 }}>
          {FILTERS.map(({ value, label }) => (
            <MenuItem key={value} value={value}>
              {label}
            </MenuItem>
          ))}
        </TextField>
        <Button onClick={() => void cache.refetch()} disabled={!gate} loading={cache.isFetching}>
          Atualizar
        </Button>
      </Stack>

      {cache.isPending && gate && <LinearProgress aria-label="Carregando o cache" />}
      {cache.isError && <ErrorState description={errorMessage(cache.error)} onRetry={() => void cache.refetch()} />}
      {cache.isSuccess && cache.data.items.length === 0 && <EmptyState title="Cache vazio" />}
      {cache.isSuccess && cache.data.items.length > 0 && (
        <TableContainer sx={{ maxHeight: 420 }}>
          <Table size="small" stickyHeader aria-label="Cache de TAGs">
            <TableHead>
              <TableRow>
                <TableCell>TAG</TableCell>
                <TableCell>Situação</TableCell>
                <TableCell>Conferida às</TableCell>
                <TableCell>Pessoa</TableCell>
                {canManage && <TableCell align="right">Ação</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {cache.data.items.map((item) => (
                <TableRow key={item.tag} hover>
                  <TableCell sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{item.tag}</TableCell>
                  <TableCell>
                    <StatusChip label={item.isValid ? "Liberada" : "Recusada"} tone={item.isValid ? "success" : "error"} />
                  </TableCell>
                  <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{timeFormat.format(new Date(item.validatedAt))}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{erpText(item.verifyData?.NOME) ?? "—"}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {joinErpText([item.verifyData?.QUADRA, item.verifyData?.LOTE], "-")}
                    </Typography>
                  </TableCell>
                  {canManage && (
                    <TableCell align="right">
                      <Button size="small" onClick={() => setConfirm({ kind: "remove", item })}>
                        Remover
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ConfirmDialog
        open={confirm?.kind === "clear"}
        title="Limpar o cache"
        description={`As TAGs (${FILTERS.find((item) => item.value === filter)?.label.toLowerCase()}) guardadas pela antena de ${gate?.nome ?? ""} saem do cache. A próxima leitura de cada uma volta a consultar o cadastro.`}
        confirmLabel="Limpar"
        tone="danger"
        loading={clear.isPending}
        onConfirm={() => clear.mutate()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === "remove"}
        title="Remover TAG do cache"
        description={confirm?.kind === "remove" ? `A próxima leitura da TAG ${confirm.item.tag} volta a consultar o cadastro.` : ""}
        confirmLabel="Remover"
        loading={remove.isPending}
        onConfirm={() => confirm?.kind === "remove" && remove.mutate(confirm.item)}
        onClose={() => setConfirm(null)}
      />
    </SectionCard>
  );
}
