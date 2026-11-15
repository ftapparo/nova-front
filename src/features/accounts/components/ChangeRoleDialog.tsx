import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { errorMessage } from "@/core/api/http";
import { STAFF_ROLE_LABEL, staffRoleOf, type StaffRole } from "@/core/session/roles";
import { useNotify } from "@/core/ui/components/useNotify";
import type { Account } from "../accountsApi";
import { useUpdateAccountRole } from "../accountsQueries";

// O <select> não aceita null como valor; "" representa "sem papel".
const NO_ROLE = "";

interface ChangeRoleDialogProps {
  account: Account;
  roles: StaffRole[];
  onClose: () => void;
}

export default function ChangeRoleDialog({ account, roles, onClose }: ChangeRoleDialogProps) {
  const notify = useNotify();
  const update = useUpdateAccountRole();
  const currentRole = staffRoleOf(account);
  const [selected, setSelected] = useState<StaffRole | typeof NO_ROLE>(currentRole ?? NO_ROLE);

  const save = () =>
    update.mutate(
      { accountId: account.id, role: selected === NO_ROLE ? null : selected },
      {
        onSuccess: () => {
          notify.success("Perfil alterado.");
          onClose();
        },
      },
    );

  return (
    <Dialog open onClose={update.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Trocar perfil</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            select
            fullWidth
            label={`Perfil de ${account.email ?? "conta"}`}
            value={selected}
            onChange={(event) => setSelected(event.target.value as StaffRole | typeof NO_ROLE)}
          >
            <MenuItem value={NO_ROLE}>Sem papel (conta comum)</MenuItem>
            {roles.map((role) => (
              <MenuItem key={role} value={role}>
                {STAFF_ROLE_LABEL[role]}
              </MenuItem>
            ))}
          </TextField>
          <Alert severity="info">
            Se a pessoa estiver com o painel aberto, o perfil novo passa a valer em até 15 minutos ou no próximo login.
          </Alert>
          {update.isError && <Alert severity="error">{errorMessage(update.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={update.isPending}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          loading={update.isPending}
          disabled={selected === (currentRole ?? NO_ROLE)}
          onClick={save}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
