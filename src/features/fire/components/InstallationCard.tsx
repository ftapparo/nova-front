import { useDeferredValue, useState } from "react";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { errorMessage } from "@/core/api/http";
import EmptyState from "@/core/ui/components/EmptyState";
import ErrorState from "@/core/ui/components/ErrorState";
import SectionCard from "@/core/ui/components/SectionCard";
import StatusChip from "@/core/ui/components/StatusChip";
import { placeLabel } from "../fireApi";
import { useInstallation } from "../fireQueries";

const SHOWN_LIMIT = 200;

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/** Dispositivos cadastrados na central, com busca por nome, tipo, local ou zona. */
export default function InstallationCard() {
  const installation = useInstallation();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const devices = (installation.data?.devices ?? []).map((device) => ({
    ...device,
    placeText: placeLabel(device.place),
  }));
  const terms = normalize(deferredSearch).split(/\s+/).filter(Boolean);
  const filtered = devices.filter((device) => {
    if (terms.length === 0) return true;
    const haystack = normalize(
      [device.name, device.device, device.placeText, device.zoneName, `${device.loop}.${device.address}`].filter(Boolean).join(" "),
    );
    return terms.every((term) => haystack.includes(term));
  });

  return (
    <SectionCard
      title="Instalação"
      subtitle={
        installation.data
          ? [installation.data.model, installation.data.installation, `${devices.length} dispositivos`].filter(Boolean).join(" · ")
          : "Dispositivos cadastrados na central."
      }
      action={
        <TextField
          size="small"
          placeholder="Buscar dispositivo"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined fontSize="small" />
                </InputAdornment>
              ),
            },
            htmlInput: { "aria-label": "Buscar dispositivo" },
          }}
        />
      }
    >
      {installation.isPending && <LinearProgress aria-label="Carregando a instalação" />}
      {installation.isError && (
        <ErrorState description={errorMessage(installation.error)} onRetry={() => void installation.refetch()} />
      )}
      {installation.isSuccess && filtered.length === 0 && <EmptyState title="Nenhum dispositivo encontrado" />}
      {filtered.length > 0 && (
        <TableContainer sx={{ maxHeight: 520 }}>
          <Table size="small" stickyHeader aria-label="Dispositivos da central">
            <TableHead>
              <TableRow>
                <TableCell>Laço.endereço</TableCell>
                <TableCell>Nome</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Local</TableCell>
                <TableCell>Zona</TableCell>
                <TableCell>Situação</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.slice(0, SHOWN_LIMIT).map((device) => (
                <TableRow key={`${device.loop}.${device.address}`} hover>
                  <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                    {device.loop}.{device.address}
                  </TableCell>
                  <TableCell>{device.name || "—"}</TableCell>
                  <TableCell>{device.device || "—"}</TableCell>
                  <TableCell>{device.placeText || "—"}</TableCell>
                  <TableCell>{[device.zone, device.zoneName].filter((part) => part !== null && part !== "").join(" ") || "—"}</TableCell>
                  <TableCell>
                    {device.enabled === false ? <StatusChip label="Desabilitado" tone="neutral" /> : <StatusChip label="Ativo" tone="success" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {filtered.length > SHOWN_LIMIT && (
        <Typography variant="caption" color="textSecondary" component="p" sx={{ mt: 1 }}>
          Mostrando {SHOWN_LIMIT} de {filtered.length}. Refine a busca para ver os demais.
        </Typography>
      )}
    </SectionCard>
  );
}
