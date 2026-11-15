import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import { applyValidationErrors } from "@/core/api/formErrors";
import { errorMessage } from "@/core/api/http";
import { STAFF_ROLE_LABEL, STAFF_ROLES, type StaffRole } from "@/core/session/roles";
import FormPasswordField from "@/core/ui/components/form/FormPasswordField";
import FormTextField from "@/core/ui/components/form/FormTextField";
import { useNotify } from "@/core/ui/components/useNotify";
import { useCreateAccount } from "../accountsQueries";

const schema = z.object({
  email: z.email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
  role: z.enum(STAFF_ROLES),
});

type CreateAccountValues = z.infer<typeof schema>;

interface CreateAccountDialogProps {
  roles: StaffRole[];
  onClose: () => void;
}

/** Montado só enquanto aberto: cada abertura começa com o formulário limpo. */
export default function CreateAccountDialog({ roles, onClose }: CreateAccountDialogProps) {
  const notify = useNotify();
  const create = useCreateAccount();
  const { control, handleSubmit, setError } = useForm<CreateAccountValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", role: "porteiro" },
  });

  const submit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: (account) => {
        notify.success(`Conta ${account.email ?? ""} criada.`);
        onClose();
      },
      onError: (error) => {
        applyValidationErrors(error, setError, ["email", "password", "role"]);
      },
    }),
  );

  return (
    <Dialog open onClose={create.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Nova conta de equipe</DialogTitle>
      <DialogContent>
        <Stack component="form" id="create-account" spacing={2} noValidate onSubmit={submit} sx={{ pt: 1 }}>
          <FormTextField control={control} name="email" label="E-mail" type="email" autoComplete="off" autoFocus />
          <FormPasswordField
            control={control}
            name="password"
            label="Senha inicial"
            autoComplete="new-password"
            helperText="Pelo menos 8 caracteres. Entregue à pessoa por um meio seguro."
          />
          <FormTextField control={control} name="role" label="Perfil" select>
            {roles.map((role) => (
              <MenuItem key={role} value={role}>
                {STAFF_ROLE_LABEL[role]}
              </MenuItem>
            ))}
          </FormTextField>
          {create.isError && <Alert severity="error">{errorMessage(create.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={create.isPending}>
          Cancelar
        </Button>
        <Button type="submit" form="create-account" variant="contained" loading={create.isPending}>
          Criar conta
        </Button>
      </DialogActions>
    </Dialog>
  );
}
