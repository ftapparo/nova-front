import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { errorMessage } from "@/core/api/http";
import ConfirmDialog from "@/core/ui/components/ConfirmDialog";
import ErrorState from "@/core/ui/components/ErrorState";
import SectionCard from "@/core/ui/components/SectionCard";
import StatusChip from "@/core/ui/components/StatusChip";
import {
  appDevicesQuery,
  sendFireAlarmTest,
  type AppDevice,
  type FireAlarmTestType,
} from "../notificationsApi";

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const deviceLabel = (device: AppDevice) =>
  `${device.email ?? "Conta sem e-mail"} — ${device.deviceModel ?? "aparelho"}${device.appVersion ? ` (app ${device.appVersion})` : ""}`;

/** Por que o aparelho não recebe o teste; null quando recebe. */
const blockedReason = (device: AppDevice): string | null => {
  if (device.platform !== "android") return "iOS ainda não recebe notificações";
  if (!device.tokenValid) return "registro recusado pelo Google; abrir o app de novo";
  if (!device.notificationsEnabled) return "notificações desligadas no aparelho";
  return null;
};

const TYPE_LABEL: Record<FireAlarmTestType, string> = { alarm: "Alarme", resolved: "Normalizado" };

/**
 * Teste do alerta prioritário do alarme de incêndio num aparelho escolhido,
 * sem acionar a central. Só admin: o alarme toca alto no celular de outra pessoa.
 */
export default function FireAlarmTestCard() {
  const devices = useQuery(appDevicesQuery);
  const [installationId, setInstallationId] = useState("");
  const [type, setType] = useState<FireAlarmTestType>("alarm");
  const [confirming, setConfirming] = useState(false);

  const selected = devices.data?.find((device) => device.installationId === installationId);

  const send = useMutation({
    mutationFn: (sent: FireAlarmTestType) => sendFireAlarmTest(installationId, sent),
    onSettled: () => setConfirming(false),
  });

  return (
    <SectionCard
      title="Teste do alarme de incêndio"
      subtitle="Envia a um aparelho o mesmo alerta do alarme real (ou o aviso de central normalizada), sem acionar a central."
    >
      {devices.isError ? (
        <ErrorState description={errorMessage(devices.error)} onRetry={() => devices.refetch()} />
      ) : (
        <Stack spacing={2}>
          <TextField
            select
            label="Aparelho"
            value={installationId}
            onChange={(event) => {
              setInstallationId(event.target.value);
              send.reset();
            }}
            disabled={!devices.data}
            helperText={devices.data?.length === 0 ? "Nenhum aparelho com o aplicativo registrado." : undefined}
          >
            {(devices.data ?? []).map((device) => {
              const reason = blockedReason(device);
              return (
                <MenuItem key={device.installationId} value={device.installationId} disabled={reason !== null}>
                  <Box>
                    <Typography variant="body2">{deviceLabel(device)}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {reason ?? `Visto em ${dateTimeFormat.format(new Date(device.lastSeenAt))}`}
                    </Typography>
                  </Box>
                </MenuItem>
              );
            })}
          </TextField>

          {selected && (
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
              <StatusChip label="Notificações ligadas" tone="success" />
              <StatusChip
                label={selected.alarmChannelEnabled ? "Canal do alarme ligado" : "Canal do alarme bloqueado"}
                tone={selected.alarmChannelEnabled ? "success" : "warning"}
              />
              <StatusChip label={`Idioma ${selected.language}`} tone="neutral" />
            </Stack>
          )}
          {selected && !selected.alarmChannelEnabled && type === "alarm" && (
            <Alert severity="warning">
              O canal do alarme está bloqueado neste aparelho: o alerta pode não tocar nem aparecer.
            </Alert>
          )}

          <ToggleButtonGroup
            exclusive
            size="small"
            color="primary"
            value={type}
            onChange={(_event, value: FireAlarmTestType | null) => value && setType(value)}
            aria-label="Tipo do teste"
          >
            <ToggleButton value="alarm">Alarme</ToggleButton>
            <ToggleButton value="resolved">Normalizado</ToggleButton>
          </ToggleButtonGroup>

          {send.isSuccess && (
            <Alert severity={send.data.failed > 0 ? "warning" : "success"}>
              {send.data.failed > 0
                ? "O Google recusou o envio para este aparelho."
                : `Teste "${TYPE_LABEL[send.variables]}" enviado ao aparelho.`}
            </Alert>
          )}
          {send.isError && <Alert severity="error">{errorMessage(send.error)}</Alert>}

          <Box>
            <Button variant="contained" color="error" disabled={!selected} onClick={() => setConfirming(true)}>
              Testar alarme
            </Button>
          </Box>
          <Typography variant="caption" color="textSecondary">
            Até 3 testes a cada 10 minutos. Para o normalizado substituir o alarme no aparelho, envie depois do teste de alarme.
          </Typography>
        </Stack>
      )}
      <ConfirmDialog
        open={confirming}
        title={type === "alarm" ? "Enviar teste do alarme de incêndio?" : "Enviar teste de central normalizada?"}
        description={
          selected
            ? `${deviceLabel(selected)}. ${
                type === "alarm"
                  ? "O aparelho vai tocar o alerta prioritário de incêndio, marcado como teste."
                  : "O aparelho recebe o aviso comum de volta ao normal, marcado como teste."
              }`
            : ""
        }
        confirmLabel="Enviar teste"
        tone={type === "alarm" ? "danger" : "default"}
        loading={send.isPending}
        onConfirm={() => send.mutate(type)}
        onClose={() => setConfirming(false)}
      />
    </SectionCard>
  );
}
