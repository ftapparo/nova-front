import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import { errorMessage } from "@/core/api/http";
import type { Account } from "../accountsApi";
import { useResetAccountPassword } from "../accountsQueries";

interface ResetPasswordDialogProps {
  account: Account;
  onClose: () => void;
}

/**
 * Confirma o reset e mostra a senha provisória uma única vez. Ela vive só no
 * estado desta mutation: ao fechar o diálogo o componente desmonta e ela some.
 * Nunca vai para storage, log ou área de transferência por conta própria.
 */
export default function ResetPasswordDialog({ account, onClose }: ResetPasswordDialogProps) {
  const reset = useResetAccountPassword();
  const temporaryPassword = reset.data?.temporaryPassword;

  return (
    <Dialog open onClose={reset.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Resetar senha</DialogTitle>
      <DialogContent>
        {temporaryPassword ? (
          <Stack spacing={2}>
            <DialogContentText>
              Senha provisória de <strong>{account.email}</strong>:
            </DialogContentText>
            <Box
              data-testid="temporary-password"
              sx={{
                fontFamily: '"Geist Mono", ui-monospace, monospace',
                fontSize: "1.5rem",
                letterSpacing: "0.08em",
                textAlign: "center",
                userSelect: "all",
                py: 1.5,
                borderRadius: 1,
                bgcolor: "action.hover",
              }}
            >
              {temporaryPassword}
            </Box>
            <Alert severity="warning">
              Anote ou entregue agora: esta senha não será mostrada de novo. A pessoa terá de trocá-la no próximo login.
            </Alert>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <DialogContentText>
              A senha atual de <strong>{account.email}</strong> deixa de valer e uma senha provisória é gerada para você
              entregar à pessoa.
            </DialogContentText>
            {reset.isError && <Alert severity="error">{errorMessage(reset.error)}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {temporaryPassword ? (
          <Button variant="contained" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={reset.isPending}>
              Cancelar
            </Button>
            <Button variant="contained" color="error" loading={reset.isPending} onClick={() => reset.mutate(account.id)}>
              Resetar senha
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
