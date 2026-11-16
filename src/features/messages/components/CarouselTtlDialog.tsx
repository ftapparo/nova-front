import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { MAX_CAROUSEL_TTL_HOURS, type CondoMessage } from "../messagesApi";

interface CarouselTtlDialogProps {
  message: CondoMessage;
  saving: boolean;
  onSave: (hours: number) => void;
  onClose: () => void;
}

export default function CarouselTtlDialog({ message, saving, onSave, onClose }: CarouselTtlDialogProps) {
  const [hours, setHours] = useState(String(message.carouselTtlHours));
  const value = Number(hours);
  const valid = Number.isInteger(value) && value >= 0 && value <= MAX_CAROUSEL_TTL_HOURS;

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Tempo no carrossel</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText>
            Por quantas horas, contadas da publicação, "{message.title}" fica no carrossel da tela inicial do aplicativo.
          </DialogContentText>
          <TextField
            label="Horas"
            type="number"
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            error={!valid}
            helperText={`De 0 a ${MAX_CAROUSEL_TTL_HOURS}. 0 = sai do carrossel de cada morador quando ele ler.`}
            slotProps={{ htmlInput: { min: 0, max: MAX_CAROUSEL_TTL_HOURS } }}
            autoFocus
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" loading={saving} disabled={!valid} onClick={() => onSave(value)}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
