import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { ApiError, errorMessage } from "@/core/api/http";
import { formatCpf, normalizePlate } from "@/core/format/documents";
import { useNotify } from "@/core/ui/components/useNotify";
import type { PersonLink } from "../queriesApi";
import {
  fetchVehicleByPlate,
  lookupPlate,
  plateOwnedByOther,
  saveVehicle,
  type VehicleFields,
} from "../vehiclesApi";

type Step =
  | { kind: "plate" }
  | { kind: "blocked"; message: string }
  | { kind: "details"; plate: string; source: "local" | "lookup" | "manual" };

interface AddVehicleDialogProps {
  ownerSeq: number;
  links: PersonLink[];
  onSaved: () => void;
  onClose: () => void;
}

const unitLabel = (link: PersonLink) => [link.unidade.quadra, link.unidade.lote].filter(Boolean).join("-") || `Unidade ${link.unidade.sequencia}`;

/**
 * Cadastro de veículo para o proprietário buscado: confere a placa no ERP,
 * busca marca, modelo e cor nas fontes externas quando ela é nova e grava.
 */
export default function AddVehicleDialog({ ownerSeq, links, onSaved, onClose }: AddVehicleDialogProps) {
  const notify = useNotify();
  const [plate, setPlate] = useState("");
  const [unitSeq, setUnitSeq] = useState<number | "">(links[0]?.unidade.sequencia ?? "");
  const [step, setStep] = useState<Step>({ kind: "plate" });
  const [fields, setFields] = useState<VehicleFields>({ brand: "", model: "", color: "" });

  const check = useMutation({
    mutationFn: async (target: string): Promise<{ step: Step; fields: VehicleFields }> => {
      const local = await fetchVehicleByPlate(target);
      if (local.exists && local.vehicle) {
        const vehicle = local.vehicle;
        if (plateOwnedByOther(vehicle, ownerSeq, unitSeq === "" ? null : unitSeq)) {
          const owner = vehicle.OWNERNOME?.trim() || `cadastro ${vehicle.PROPRIETARIO ?? "?"}`;
          const unit = [vehicle.UNIDADEQUADRA, vehicle.UNIDADELOTE].filter(Boolean).join("-") || "—";
          return {
            step: {
              kind: "blocked",
              message: `Placa já vinculada a ${owner}${vehicle.OWNERCPF ? `, CPF ${formatCpf(vehicle.OWNERCPF)}` : ""}, unidade ${unit}. Para transferir, remova o veículo do cadastro atual primeiro.`,
            },
            fields: { brand: "", model: "", color: "" },
          };
        }
        return {
          step: { kind: "details", plate: target, source: "local" },
          fields: { brand: vehicle.MARCA ?? "", model: vehicle.MODELO ?? "", color: vehicle.COR ?? "" },
        };
      }

      try {
        const found = await lookupPlate(target);
        const { brand, model, color } = found.consolidated;
        if (found.overallSuccess) {
          return { step: { kind: "details", plate: target, source: "lookup" }, fields: { brand: brand ?? "", model: model ?? "", color: color ?? "" } };
        }
      } catch (error) {
        // 409: a busca externa achou a placa ligada a outro proprietário.
        if (error instanceof ApiError && error.type === "conflict") {
          return { step: { kind: "blocked", message: error.message }, fields: { brand: "", model: "", color: "" } };
        }
        // Fonte externa fora do ar ou limite de consultas: segue com digitação manual.
        if (!(error instanceof ApiError) || (error.type !== "upstream-error" && error.type !== "rate-limited")) throw error;
      }
      return { step: { kind: "details", plate: target, source: "manual" }, fields: { brand: "", model: "", color: "" } };
    },
    onSuccess: (result) => {
      setStep(result.step);
      setFields(result.fields);
    },
  });

  const save = useMutation({
    mutationFn: (target: string) =>
      saveVehicle(target, { ...fields, ownerSeq, unitSeq: unitSeq === "" ? null : unitSeq }),
    onSuccess: (result) => {
      notify.success(result.created ? "Veículo cadastrado." : "Veículo atualizado.");
      onSaved();
      onClose();
    },
  });

  const submitPlate = (event: FormEvent) => {
    event.preventDefault();
    if (plate.length === 7) check.mutate(plate);
  };

  const complete = fields.brand.trim() && fields.model.trim() && fields.color.trim();
  const busy = check.isPending || save.isPending;

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Adicionar veículo</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            label="Unidade"
            value={unitSeq}
            onChange={(event) => setUnitSeq(Number(event.target.value))}
            disabled={step.kind === "details"}
          >
            {links.map((link) => (
              <MenuItem key={link.pessoaVinculo.sequencia} value={link.unidade.sequencia}>
                {unitLabel(link)}
              </MenuItem>
            ))}
          </TextField>

          <Stack component="form" direction="row" spacing={1} onSubmit={submitPlate} noValidate>
            <TextField
              label="Placa"
              value={plate}
              onChange={(event) => {
                setPlate(normalizePlate(event.target.value));
                setStep({ kind: "plate" });
                check.reset();
              }}
              slotProps={{ htmlInput: { autoComplete: "off" } }}
              sx={{ flexGrow: 1 }}
              autoFocus
            />
            <Button type="submit" variant="outlined" loading={check.isPending} disabled={plate.length !== 7 || save.isPending}>
              Consultar placa
            </Button>
          </Stack>
          {check.isPending && <Alert severity="info">Consultando a placa. A busca nas fontes externas pode levar alguns segundos.</Alert>}
          {check.isError && <Alert severity="error">{errorMessage(check.error)}</Alert>}
          {step.kind === "blocked" && <Alert severity="warning">{step.message}</Alert>}

          {step.kind === "details" && (
            <>
              <Alert severity={step.source === "manual" ? "warning" : "success"}>
                {step.source === "local" && "Veículo já cadastrado para este proprietário. Confira os dados."}
                {step.source === "lookup" && "Dados encontrados nas fontes externas. Confira antes de gravar."}
                {step.source === "manual" && "Não foi possível localizar a placa. Preencha marca, modelo e cor."}
              </Alert>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                {(["brand", "model", "color"] as const).map((key) => (
                  <TextField
                    key={key}
                    label={{ brand: "Marca", model: "Modelo", color: "Cor" }[key]}
                    value={fields[key]}
                    onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value.toUpperCase() }))}
                    fullWidth
                  />
                ))}
              </Stack>
            </>
          )}
          {save.isError && <Alert severity="error">{errorMessage(save.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          loading={save.isPending}
          disabled={step.kind !== "details" || !complete || check.isPending}
          onClick={() => step.kind === "details" && save.mutate(step.plate)}
        >
          Gravar veículo
        </Button>
      </DialogActions>
    </Dialog>
  );
}
