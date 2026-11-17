import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { errorMessage } from "@/core/api/http";
import PushBrowserCard from "@/core/push/PushBrowserCard";
import { useSession } from "@/core/session/useSession";
import ConfirmDialog from "@/core/ui/components/ConfirmDialog";
import SectionCard from "@/core/ui/components/SectionCard";
import { useNotify } from "@/core/ui/components/useNotify";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import FireAlarmTestCard from "./components/FireAlarmTestCard";
import { BODY_MAX, sendAppTest, sendStaffBroadcast, TITLE_MAX } from "./notificationsApi";

function StaffBroadcastCard() {
  const notify = useNotify();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirming, setConfirming] = useState(false);

  const send = useMutation({
    mutationFn: () => sendStaffBroadcast(title.trim(), body.trim()),
    onSuccess: ({ dispatch }) => {
      notify.success(`Aviso enviado a ${dispatch.sent} de ${dispatch.totalSubscriptions} navegador(es).`);
      setTitle("");
      setBody("");
      setConfirming(false);
    },
    onError: () => setConfirming(false),
  });

  const ready = title.trim() && body.trim();

  return (
    <SectionCard
      title="Aviso para a equipe"
      subtitle="Chega como notificação nos navegadores da equipe com alertas ativados. Para os moradores, use Comunicados."
    >
      <Stack spacing={2}>
        <TextField label="Título" value={title} onChange={(event) => setTitle(event.target.value)} slotProps={{ htmlInput: { maxLength: TITLE_MAX } }} />
        <TextField
          label="Texto"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          multiline
          minRows={3}
          slotProps={{ htmlInput: { maxLength: BODY_MAX } }}
        />
        {send.isError && <Alert severity="error">{errorMessage(send.error)}</Alert>}
        <Box>
          <Button variant="contained" disabled={!ready} onClick={() => setConfirming(true)}>
            Enviar aviso
          </Button>
        </Box>
      </Stack>
      <ConfirmDialog
        open={confirming}
        title="Enviar aviso para a equipe?"
        description={`"${title.trim()}" vai como notificação para todos os navegadores da equipe com alertas ativados.`}
        confirmLabel="Enviar"
        loading={send.isPending}
        onConfirm={() => send.mutate()}
        onClose={() => setConfirming(false)}
      />
    </SectionCard>
  );
}

function AppTestCard() {
  const test = useMutation({ mutationFn: sendAppTest });

  return (
    <SectionCard title="Teste no aplicativo" subtitle="Envia uma notificação de teste aos aparelhos em que a sua conta está no aplicativo.">
      <Stack spacing={2}>
        {test.isSuccess && (
          <Alert severity={test.data.targets === 0 ? "warning" : test.data.failed > 0 ? "warning" : "success"}>
            {test.data.targets === 0
              ? "Nenhum aparelho com o aplicativo registrado nesta conta."
              : `Enviado a ${test.data.sent} de ${test.data.targets} aparelho(s)${test.data.failed ? `; ${test.data.failed} falharam` : ""}.`}
          </Alert>
        )}
        {test.isError && <Alert severity="error">{errorMessage(test.error)}</Alert>}
        <Box>
          <Button variant="outlined" loading={test.isPending} onClick={() => test.mutate()}>
            Enviar teste
          </Button>
        </Box>
        <Typography variant="caption" color="textSecondary">
          A entrega depende do celular (economia de bateria pode atrasar). Até 3 testes a cada 10 minutos.
        </Typography>
      </Stack>
    </SectionCard>
  );
}

export default function NotificationsPage() {
  const isAdmin = useSession()?.user.role === "admin";
  return (
    <PageContainer>
      <PageHeader title="Notificações" subtitle="Alertas da equipe no navegador, avisos e testes." />
      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" } }}>
        <Stack spacing={3}>
          <PushBrowserCard />
          <AppTestCard />
        </Stack>
        <Stack spacing={3}>
          <StaffBroadcastCard />
          {isAdmin && <FireAlarmTestCard />}
        </Stack>
      </Box>
    </PageContainer>
  );
}
