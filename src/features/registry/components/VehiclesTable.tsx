import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MoreVert from "@mui/icons-material/MoreVert";
import { vehicleDescription, type Vehicle } from "../vehiclesApi";

export type VehicleAction = "tag" | "remove-tag" | "unlink";

function RowActions({ vehicle, onAction }: { vehicle: Vehicle; onAction: (action: VehicleAction) => void }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const actions: [VehicleAction, string][] = [
    ["tag", vehicle.TAGVEICULO ? "Trocar TAG" : "Vincular TAG"],
    ...(vehicle.TAGVEICULO ? ([["remove-tag", "Remover TAG"]] as [VehicleAction, string][]) : []),
    ["unlink", "Desvincular do proprietário"],
  ];

  return (
    <>
      <IconButton size="small" aria-label={`Ações do veículo ${vehicle.PLACA}`} onClick={(event) => setAnchor(event.currentTarget)}>
        <MoreVert fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {actions.map(([action, label]) => (
          <MenuItem
            key={action}
            onClick={() => {
              setAnchor(null);
              onAction(action);
            }}
          >
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export default function VehiclesTable({
  vehicles,
  onAction,
}: {
  vehicles: Vehicle[];
  onAction: (vehicle: Vehicle, action: VehicleAction) => void;
}) {
  return (
    <TableContainer>
      <Table size="small" aria-label="Veículos do proprietário">
        <TableHead>
          <TableRow>
            <TableCell>Placa</TableCell>
            <TableCell>Veículo</TableCell>
            <TableCell>Unidade</TableCell>
            <TableCell>TAG</TableCell>
            <TableCell align="right">Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {vehicles.map((vehicle) => (
            <TableRow key={vehicle.SEQUENCIA} hover>
              <TableCell sx={{ fontWeight: 600 }}>{vehicle.PLACA}</TableCell>
              <TableCell>{vehicleDescription(vehicle)}</TableCell>
              <TableCell>{[vehicle.UNIDADEQUADRA, vehicle.UNIDADELOTE].filter(Boolean).join("-") || "—"}</TableCell>
              <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{vehicle.TAGVEICULO || "—"}</TableCell>
              <TableCell align="right">
                <RowActions vehicle={vehicle} onAction={(action) => onAction(vehicle, action)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
