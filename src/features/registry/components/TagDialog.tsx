import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { ApiError, errorMessage } from "@/core/api/http";
import { onlyDigits, TAG_LENGTH } from "@/core/format/documents";
import { useNotify } from "@/core/ui/components/useNotify";
import { linkTag, SWAP_CONFIRMATION_TITLE, type Vehicle } from "../vehiclesApi";

interface TagDialogProps {
  vehicle: Vehicle;
  ownerCpf: string;
  /** Portão de entrada usado pela API para validar a TAG. */
  numeroDispositivo: number;
  onSaved: () => void;
  onClose: () => void;
}

/** Vincula ou troca a TAG do veículo. A troca de outra TAG pede confirmação explícita. */
export default function TagDialog({ vehicle, ownerCpf, numeroDispositivo, onSaved, onClose }: TagDialogProps) {
  const notify = useNotify();
  const [tag, setTag] = useState(onlyDigits(vehicle.TAGVEICULO).slice(0, TAG_LENGTH));
  const [needsSwap, setNeedsSwap] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (forceSwap: boolean) => linkTag(vehicle.SEQUENCIA, { cpf: ownerCpf, tag, numeroDispositivo, forceSwap }),
    onSuccess: (result) => {
      notify.success(result.status === "swapped" ? "TAG trocada." : "TAG vinculada.");
      onSaved();
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.type === "conflict" && error.title === SWAP_CONFIRMATION_TITLE) {
        setNeedsSwap(error.message);
      }
    },
  });

  const swapPending = needsSwap !== null;
  const showError = save.isError && !swapPending;

  return (
    <Dialog open onClose={save.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{vehicle.TAGVEICULO ? "Trocar TAG" : "Vincular TAG"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <DialogContentText>Veículo {vehicle.PLACA}.</DialogContentText>
          <TextField
            label="TAG (10 dígitos)"
            value={tag}
            onChange={(event) => {
              setTag(onlyDigits(event.target.value).slice(0, TAG_LENGTH));
              setNeedsSwap(null);
              save.reset();
            }}
            slotProps={{ htmlInput: { inputMode: "numeric", autoComplete: "off" } }}
            disabled={swapPending}
            autoFocus
          />
          {swapPending && (
            <Alert severity="warning">
              {needsSwap} Confirmar a troca? A TAG atual deixa de funcionar.
            </Alert>
          )}
          {showError && <Alert severity="error">{errorMessage(save.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancelar
        </Button>
        {swapPending ? (
          <Button variant="contained" color="warning" loading={save.isPending} onClick={() => save.mutate(true)}>
            Trocar a TAG
          </Button>
        ) : (
          <Button variant="contained" loading={save.isPending} disabled={tag.length !== TAG_LENGTH} onClick={() => save.mutate(false)}>
            Salvar TAG
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
