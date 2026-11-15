import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import EmptyState from "@/core/ui/components/EmptyState";
import StatusChip from "@/core/ui/components/StatusChip";
import { isFlagSet, type VehicleQuery } from "../queriesApi";
import PersonCard from "./PersonCard";

/** Resultado da consulta por placa ou por TAG: veículo, unidade, proprietário e credenciais. */
export default function VehicleQueryResult({ result }: { result: VehicleQuery }) {
  if (!result.exists || !result.vehicle) return <EmptyState title="Nenhum veículo encontrado" />;
  const { vehicle, unit, owner, accesses } = result;

  return (
    <Stack spacing={2} divider={<Divider />}>
      <div>
        <Typography variant="h3" component="p">
          {vehicle.placa || "Sem placa"}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {[vehicle.marca, vehicle.modelo, vehicle.cor].filter(Boolean).join(" · ") || "Sem marca, modelo e cor"}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Unidade {unit ? [unit.quadra, unit.lote].filter(Boolean).join("-") || "—" : "—"}
          {vehicle.tagVeiculo ? ` · TAG ${vehicle.tagVeiculo}` : " · sem TAG"}
        </Typography>
      </div>

      {owner ? <PersonCard person={owner} /> : <Typography variant="body2">Sem proprietário vinculado.</Typography>}

      {accesses.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="overline" color="textSecondary">
            Credenciais de acesso
          </Typography>
          {accesses.map((access) => (
            <Stack key={access.sequencia} direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Typography sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                {[access.id, access.id2].filter(Boolean).join(" / ") || "—"}
              </Typography>
              {access.tipo && (
                <Typography variant="body2" color="textSecondary">
                  {access.tipo}
                </Typography>
              )}
              {access.acessoLiberado !== undefined && (
                <StatusChip
                  label={isFlagSet(access.acessoLiberado) ? "Liberada" : "Bloqueada"}
                  tone={isFlagSet(access.acessoLiberado) ? "success" : "error"}
                />
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
