import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { errorMessage } from "@/core/api/http";
import SectionCard from "@/core/ui/components/SectionCard";
import StatusChip from "@/core/ui/components/StatusChip";
import { usePushState } from "./usePush";

/** Liga e desliga os alertas (alarme de incêndio, avisos à equipe) neste navegador. */
export default function PushBrowserCard() {
  const { state, loading, enable, disable } = usePushState();
  const busy = enable.isPending || disable.isPending;

  return (
    <SectionCard
      title="Alertas neste navegador"
      subtitle="Alarme e falha da central de incêndio e avisos à equipe, mesmo com o painel em segundo plano."
      action={
        state === "on" ? (
          <StatusChip label="Ativados" tone="success" />
        ) : state === "denied" ? (
          <StatusChip label="Bloqueados" tone="error" />
        ) : state === "unsupported" ? (
          <StatusChip label="Indisponíveis" tone="neutral" />
        ) : (
          <StatusChip label="Desativados" tone="warning" />
        )
      }
    >
      <Stack spacing={2}>
        {state === "unsupported" && (
          <Typography variant="body2">Este navegador não recebe notificações. Use Chrome, Edge ou Firefox atualizados.</Typography>
        )}
        {state === "denied" && (
          <Alert severity="warning">
            As notificações foram bloqueadas para este site. Libere nas configurações do navegador (ícone ao lado do endereço)
            e volte aqui.
          </Alert>
        )}
        {(state === "off" || state === "on") && (
          <Stack direction="row" spacing={1}>
            {state === "off" ? (
              <Button variant="contained" loading={enable.isPending} disabled={busy || loading} onClick={() => enable.mutate()}>
                Ativar alertas
              </Button>
            ) : (
              <Button variant="outlined" loading={disable.isPending} disabled={busy} onClick={() => disable.mutate()}>
                Desativar neste navegador
              </Button>
            )}
          </Stack>
        )}
        {(enable.isError || disable.isError) && <Alert severity="error">{errorMessage(enable.error ?? disable.error)}</Alert>}
        <Typography variant="caption" color="textSecondary">
          Os alertas são da sua conta: param ao sair do painel e voltam ao entrar de novo neste navegador.
        </Typography>
      </Stack>
    </SectionCard>
  );
}
