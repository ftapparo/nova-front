import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { usePushState } from "@/core/push/usePush";

/**
 * Lembra a portaria de ativar os alertas de incêndio neste navegador. Some
 * quando estão ativos ou quando o navegador não tem suporte.
 */
export default function PushReminder() {
  const { state, enable } = usePushState();

  if (state === "off") {
    return (
      <Alert
        severity="warning"
        action={
          <Button color="inherit" size="small" loading={enable.isPending} onClick={() => enable.mutate()}>
            Ativar alertas
          </Button>
        }
      >
        Os alertas de incêndio estão desativados neste navegador.
      </Alert>
    );
  }
  if (state === "denied") {
    return (
      <Alert severity="warning">
        As notificações estão bloqueadas neste navegador: os alertas de incêndio não chegam. Libere nas configurações do site
        (ícone ao lado do endereço).
      </Alert>
    );
  }
  return null;
}
