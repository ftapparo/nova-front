import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { erpText, joinErpText } from "@/core/format/erpText";
import EmptyState from "@/core/ui/components/EmptyState";
import StatusChip from "@/core/ui/components/StatusChip";
import { isFlagSet, type VehicleQuery } from "../queriesApi";
import PersonCard from "./PersonCard";

/** Resultado da consulta por placa ou por TAG: veículo, unidade, proprietário e credenciais. */
export default function VehicleQueryResult({ result }: { result: VehicleQuery }) {
  if (!result.exists || !result.vehicle) return <EmptyState title="Nenhum veículo encontrado" />;
  const { vehicle, unit, owner, accesses } = result;
  const tag = erpText(vehicle.tagVeiculo);

  return (
    <Stack spacing={2} divider={<Divider />}>
      <div>
        <Typography variant="h3" component="p">
          {erpText(vehicle.placa) ?? "Sem placa"}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {joinErpText([vehicle.marca, vehicle.modelo, vehicle.cor], " · ") || "Sem marca, modelo e cor"}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Unidade {(unit && joinErpText([unit.quadra, unit.lote], "-")) || "—"}
          {tag ? ` · TAG ${tag}` : " · sem TAG"}
        </Typography>
      </div>

      {owner ? <PersonCard person={owner} /> : <Typography variant="body2">Sem proprietário vinculado.</Typography>}

      {accesses.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="overline" color="textSecondary">
            Credenciais de acesso
          </Typography>
          {accesses.map((access) => {
            const kind = erpText(access.tipo);
            return (
              <Stack key={access.sequencia} direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                <Typography sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                  {joinErpText([access.id, access.id2], " / ") || "—"}
                </Typography>
                {kind && (
                  <Typography variant="body2" color="textSecondary">
                    {kind}
                  </Typography>
                )}
                {access.acessoLiberado !== undefined && (
                  <StatusChip
                    label={isFlagSet(access.acessoLiberado) ? "Liberada" : "Bloqueada"}
                    tone={isFlagSet(access.acessoLiberado) ? "success" : "error"}
                  />
                )}
              </Stack>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}
