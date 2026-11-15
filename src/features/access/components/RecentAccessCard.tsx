import { useState } from "react";
import Alert from "@mui/material/Alert";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import EmptyState from "@/core/ui/components/EmptyState";
import SectionCard from "@/core/ui/components/SectionCard";
import type { Gate } from "@/features/gates/gatesApi";
import { formatErpDateTime, sentidoLabel, unitLabel } from "../accessFormat";
import { useRecentAccess } from "../accessQueries";

const ALL = "all";

export default function RecentAccessCard({ gates }: { gates: Gate[] }) {
  const [filter, setFilter] = useState<number | typeof ALL>(ALL);
  const shown = filter === ALL ? gates : gates.filter((gate) => gate.numeroDispositivo === filter);
  const recent = useRecentAccess(shown);

  return (
    <SectionCard
      title="Últimas passagens"
      subtitle="Gravadas no sistema do condomínio. Atualiza sozinho."
      action={
        <TextField
          select
          size="small"
          label="Portão"
          value={filter}
          onChange={(event) => setFilter(event.target.value === ALL ? ALL : Number(event.target.value))}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value={ALL}>Todos os portões</MenuItem>
          {gates.map((gate) => (
            <MenuItem key={gate.numeroDispositivo} value={gate.numeroDispositivo}>
              {gate.nome}
            </MenuItem>
          ))}
        </TextField>
      }
    >
      {recent.isPending && <LinearProgress aria-label="Carregando as passagens" />}
      {recent.failedGates.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Não foi possível carregar: {recent.failedGates.join(", ")}.
        </Alert>
      )}
      {!recent.isPending && recent.rows.length === 0 && <EmptyState title="Nenhuma passagem recente" />}
      {recent.rows.length > 0 && (
        <TableContainer>
          <Table size="small" aria-label="Últimas passagens">
            <TableHead>
              <TableRow>
                <TableCell>Data e hora</TableCell>
                <TableCell>Portão</TableCell>
                <TableCell>Sentido</TableCell>
                <TableCell>Nome</TableCell>
                <TableCell>Unidade</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Identificação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recent.rows.map((row) => (
                <TableRow key={row.key} hover>
                  <TableCell sx={{ whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                    {formatErpDateTime(row.DATAHORA)}
                  </TableCell>
                  <TableCell>{row.gateName}</TableCell>
                  <TableCell>{sentidoLabel(row.SENTIDO)}</TableCell>
                  <TableCell>{row.NOME || "—"}</TableCell>
                  <TableCell>{unitLabel(row.TORRE, row.APARTAMENTO)}</TableCell>
                  <TableCell>{row.DESCRICAO || "—"}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {row.IDACESSO || "—"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </SectionCard>
  );
}
