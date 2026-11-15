import { useState } from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import CommandButton from "@/core/ui/components/CommandButton";
import type { Command } from "@/core/ui/useCommand";
import { DEFAULT_MINUTES, MAX_MINUTES, MIN_MINUTES, exhaustLabel, type Exhaust } from "../exhaustApi";

const PRESETS = [60, 120, 180, 240, 360] as const;
const CUSTOM = "custom";

const hoursLabel = (minutes: number) => (minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`);

interface TurnOnDialogProps {
  exhaust: Exhaust;
  command: Command<number>;
  onClose: () => void;
}

/** Montado só enquanto aberto: cada abertura começa no tempo padrão. */
export default function TurnOnDialog({ exhaust, command, onClose }: TurnOnDialogProps) {
  const [choice, setChoice] = useState<number | typeof CUSTOM>(DEFAULT_MINUTES);
  const [custom, setCustom] = useState(String(DEFAULT_MINUTES));

  const minutes = choice === CUSTOM ? Number(custom) : choice;
  const valid = Number.isInteger(minutes) && minutes >= MIN_MINUTES && minutes <= MAX_MINUTES;
  const restarting = exhaust.on;

  return (
    <Dialog open onClose={command.pending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{restarting ? "Reiniciar o tempo" : "Ligar exaustor"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText>
            {exhaustLabel(exhaust)}.{" "}
            {restarting
              ? "Já está ligado: o tempo volta a contar a partir de agora, sem desligar."
              : "Desliga sozinho ao fim do tempo."}
          </DialogContentText>
          <TextField
            select
            label="Tempo"
            value={choice}
            onChange={(event) => setChoice(event.target.value === CUSTOM ? CUSTOM : Number(event.target.value))}
          >
            {PRESETS.map((preset) => (
              <MenuItem key={preset} value={preset}>
                {hoursLabel(preset)}
                {preset === DEFAULT_MINUTES ? " (padrão)" : ""}
              </MenuItem>
            ))}
            <MenuItem value={CUSTOM}>Outro tempo</MenuItem>
          </TextField>
          {choice === CUSTOM && (
            <TextField
              label="Minutos"
              type="number"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              error={!valid}
              helperText={`De ${MIN_MINUTES} a ${MAX_MINUTES} minutos.`}
              slotProps={{ htmlInput: { min: MIN_MINUTES, max: MAX_MINUTES } }}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={command.pending}>
          Cancelar
        </Button>
        <CommandButton command={command} variant="contained" disabled={!valid} onClick={() => command.run(minutes)}>
          {restarting ? "Reiniciar tempo" : "Ligar"}
        </CommandButton>
      </DialogActions>
    </Dialog>
  );
}
