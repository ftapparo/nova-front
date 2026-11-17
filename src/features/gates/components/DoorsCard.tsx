import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import EditOutlined from "@mui/icons-material/EditOutlined";
import { errorMessage } from "@/core/api/http";
import { useSetting } from "@/core/settings/userSettings";
import CommandButton from "@/core/ui/components/CommandButton";
import EmptyState from "@/core/ui/components/EmptyState";
import SectionCard from "@/core/ui/components/SectionCard";
import StatusChip from "@/core/ui/components/StatusChip";
import { useNotify } from "@/core/ui/components/useNotify";
import { useCommand } from "@/core/ui/useCommand";
import { DOOR_NAME_MAX, DOOR_NAMES_SETTING, doorDisplayName, openDoor, type DoorNames } from "../gatesApi";
import type { DoorView } from "../gatesQueries";

function DoorRow({ door, name, onRename }: { door: DoorView; name: string; onRename: () => void }) {
  const open = useCommand({
    mutationFn: () => openDoor(door.id),
    successMessage: () => `${name}: aberta.`,
  });
  const renamed = name !== door.nome;

  return (
    <ListItem
      divider
      secondaryAction={
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Tooltip title="Renomear para você">
            <IconButton size="small" aria-label={`Renomear ${name}`} onClick={onRename}>
              <EditOutlined fontSize="small" />
            </IconButton>
          </Tooltip>
          <CommandButton command={open} variant="outlined" size="small" onClick={() => open.run()}>
            Abrir
          </CommandButton>
        </Stack>
      }
      sx={{ pr: 18 }}
    >
      <ListItemText
        primary={name}
        secondary={
          <Stack component="span" direction="row" spacing={1} sx={{ mt: 0.5, alignItems: "center", flexWrap: "wrap" }}>
            {door.online === null ? (
              <StatusChip label="Sem leitura" tone="neutral" />
            ) : (
              <StatusChip label={door.online ? "Online" : "Sem comunicação"} tone={door.online ? "success" : "error"} />
            )}
            {renamed && <span>Cadastro: {door.nome}</span>}
          </Stack>
        }
        slotProps={{ secondary: { component: "span" } }}
      />
    </ListItem>
  );
}

interface RenameDialogProps {
  door: DoorView;
  current: string;
  saving: boolean;
  error: unknown;
  onSave: (name: string) => void;
  onClose: () => void;
}

function RenameDialog({ door, current, saving, error, onSave, onClose }: RenameDialogProps) {
  const [value, setValue] = useState(current === door.nome ? "" : current);

  return (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Renomear porta</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText>
            Nome no cadastro: <strong>{door.nome}</strong>. O nome novo vale só para você, em qualquer computador. Vazio volta ao
            nome do cadastro.
          </DialogContentText>
          <TextField
            label="Nome"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            slotProps={{ htmlInput: { maxLength: DOOR_NAME_MAX } }}
            autoFocus
          />
          {error ? <Alert severity="error">{errorMessage(error)}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" loading={saving} onClick={() => onSave(value.trim())}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function DoorsCard({ doors }: { doors: DoorView[] }) {
  const notify = useNotify();
  const names = useSetting<DoorNames>(DOOR_NAMES_SETTING, {});
  const [renaming, setRenaming] = useState<DoorView | null>(null);

  const save = (door: DoorView, name: string) => {
    const next = { ...names.value };
    if (name && name !== door.nome) next[String(door.id)] = name;
    else delete next[String(door.id)];
    names.save.mutate(next, {
      onSuccess: () => {
        notify.success(name ? "Nome da porta salvo." : "A porta voltou ao nome do cadastro.");
        setRenaming(null);
      },
    });
  };

  return (
    <SectionCard title="Portas de pedestre">
      {doors.length === 0 ? (
        <EmptyState title="Nenhuma porta ativa" />
      ) : (
        <List disablePadding aria-label="Portas de pedestre">
          {[...doors]
            .map((door) => ({ door, name: doorDisplayName(door, names.value) }))
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
            .map(({ door, name }) => (
              <DoorRow key={door.id} door={door} name={name} onRename={() => setRenaming(door)} />
            ))}
        </List>
      )}
      {renaming && (
        <RenameDialog
          door={renaming}
          current={doorDisplayName(renaming, names.value)}
          saving={names.save.isPending}
          error={names.save.error}
          onSave={(name) => save(renaming, name)}
          onClose={() => {
            names.save.reset();
            setRenaming(null);
          }}
        />
      )}
    </SectionCard>
  );
}
