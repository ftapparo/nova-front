import { useMutation } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import { ApiError, errorMessage } from "@/core/api/http";
import type { TemporaryPassword } from "../accountsApi";

interface ResetPasswordDialogProps {
  /** Quem perde a senha atual: e-mail da conta ou nome da pessoa. */
  targetLabel: string;
  reset: () => Promise<TemporaryPassword>;
  onClose: () => void;
}

// Mensagens próprias para as recusas com significado nesta ação.
const resetErrorMessage = (error: unknown) => {
  if (error instanceof ApiError && error.type === "forbidden") return "Seu perfil não pode resetar a senha desta conta.";
  if (error instanceof ApiError && error.type === "not-found") return "Esta pessoa não tem conta vinculada no aplicativo.";
  return errorMessage(error);
};

/**
 * Confirma o reset e mostra a senha provisória uma única vez. Ela vive só no
 * estado desta mutation: ao fechar o diálogo o componente desmonta e ela some.
 * Nunca vai para storage, log ou área de transferência por conta própria.
 */
export default function ResetPasswordDialog({ targetLabel, reset, onClose }: ResetPasswordDialogProps) {
  const mutation = useMutation({ mutationFn: reset });
  const result = mutation.data;

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Resetar senha</DialogTitle>
      <DialogContent>
        {result ? (
          <Stack spacing={2}>
            <DialogContentText>
              Senha provisória de <strong>{result.email ?? targetLabel}</strong>:
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
              {result.temporaryPassword}
            </Box>
            <Alert severity="warning">
              Anote ou entregue agora: esta senha não será mostrada de novo. A pessoa terá de trocá-la no próximo login.
            </Alert>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <DialogContentText>
              A senha atual de <strong>{targetLabel}</strong> deixa de valer e uma senha provisória é gerada para você
              entregar à pessoa.
            </DialogContentText>
            {mutation.isError && <Alert severity="error">{resetErrorMessage(mutation.error)}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {result ? (
          <Button variant="contained" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button variant="contained" color="error" loading={mutation.isPending} onClick={() => mutation.mutate()}>
              Resetar senha
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
