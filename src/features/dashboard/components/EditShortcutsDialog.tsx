import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import { errorMessage } from "@/core/api/http";
import { MAX_SHORTCUTS, newShortcutId, type Shortcut } from "../shortcuts";

export interface Equipment {
  key: string;
  kind: Shortcut["kind"];
  target: number;
  name: string;
}

interface EditShortcutsDialogProps {
  current: Shortcut[];
  equipment: Equipment[];
  saving: boolean;
  saveError: unknown;
  onSave: (shortcuts: Shortcut[]) => void;
  onClose: () => void;
}

/** Montado só enquanto aberto: edita uma cópia e grava tudo de uma vez. */
export default function EditShortcutsDialog({ current, equipment, saving, saveError, onSave, onClose }: EditShortcutsDialogProps) {
  const [draft, setDraft] = useState<Shortcut[]>(current);
  const [choice, setChoice] = useState(equipment[0]?.key ?? "");
  const [label, setLabel] = useState("");

  const nameOf = (shortcut: Shortcut) =>
    equipment.find((item) => item.kind === shortcut.kind && item.target === shortcut.target)?.name ?? "Equipamento removido";

  const add = () => {
    const item = equipment.find((entry) => entry.key === choice);
    if (!item) return;
    setDraft((list) => [...list, { id: newShortcutId(), kind: item.kind, target: item.target, label: label.trim() }]);
    setLabel("");
  };

  const full = draft.length >= MAX_SHORTCUTS;

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Atalhos</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="textSecondary">
            Ficam na sua conta: aparecem em qualquer computador em que você entrar. Até {MAX_SHORTCUTS}.
          </Typography>

          {draft.length === 0 ? (
            <Typography variant="body2">Nenhum atalho.</Typography>
          ) : (
            <List dense disablePadding aria-label="Atalhos configurados">
              {draft.map((shortcut) => (
                <ListItem
                  key={shortcut.id}
                  divider
                  secondaryAction={
                    <IconButton
                      edge="end"
                      aria-label={`Remover atalho ${shortcut.label || nameOf(shortcut)}`}
                      onClick={() => setDraft((list) => list.filter((item) => item.id !== shortcut.id))}
                    >
                      <DeleteOutlined fontSize="small" />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={shortcut.label || nameOf(shortcut)}
                    secondary={`${shortcut.kind === "door" ? "Porta" : "Portão"} · ${nameOf(shortcut)}`}
                  />
                </ListItem>
              ))}
            </List>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
            <TextField
              select
              label="Equipamento"
              value={choice}
              onChange={(event) => setChoice(event.target.value)}
              disabled={full}
              sx={{ minWidth: 220 }}
            >
              {equipment.map((item) => (
                <MenuItem key={item.key} value={item.key}>
                  {item.kind === "door" ? "Porta" : "Portão"} · {item.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Nome (opcional)" value={label} onChange={(event) => setLabel(event.target.value)} disabled={full} />
            <Button onClick={add} disabled={full || !choice}>
              Adicionar
            </Button>
          </Stack>
          {saveError ? <Alert severity="error">{errorMessage(saveError)}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" loading={saving} onClick={() => onSave(draft)}>
          Salvar atalhos
        </Button>
      </DialogActions>
    </Dialog>
  );
}
