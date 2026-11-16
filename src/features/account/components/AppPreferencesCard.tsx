import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { errorMessage } from "@/core/api/http";
import ErrorState from "@/core/ui/components/ErrorState";
import SectionCard from "@/core/ui/components/SectionCard";
import { useNotify } from "@/core/ui/components/useNotify";
import { fetchPreferences, PREFERENCES_KEY, updatePreference, type AppNotificationPreferences, type PreferenceKey } from "../accountApi";

const OPTIONS: { key: PreferenceKey; label: (prefs: AppNotificationPreferences) => string }[] = [
  { key: "cieStaffAlerts", label: () => "Alertas da central além do alarme (falha, supervisão, reinício, sem comunicação)" },
  { key: "messages", label: () => "Comunicado novo" },
  { key: "exhaustExpiring", label: (prefs) => `Exaustor que liguei: aviso ${prefs.exhaustExpiringMinutes} min antes de desligar` },
  { key: "exhaustOff", label: () => "Exaustor que liguei: aviso quando desligar" },
];

/** Preferências das notificações do aplicativo da conta. O alarme de incêndio não depende delas. */
export default function AppPreferencesCard() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const prefs = useQuery({ queryKey: PREFERENCES_KEY, queryFn: ({ signal }) => fetchPreferences(signal) });

  const update = useMutation({
    mutationFn: ({ key, value }: { key: PreferenceKey; value: boolean }) => updatePreference(key, value),
    onSuccess: (saved) => queryClient.setQueryData(PREFERENCES_KEY, saved),
    onError: (error) => notify.error(errorMessage(error)),
  });

  return (
    <SectionCard title="Notificações no aplicativo" subtitle="Para os celulares em que você usa o aplicativo Nova Residence com esta conta.">
      {prefs.isPending && <LinearProgress aria-label="Carregando as preferências" />}
      {prefs.isError && <ErrorState description={errorMessage(prefs.error)} onRetry={() => void prefs.refetch()} />}
      {prefs.isSuccess && (
        <Stack>
          {OPTIONS.map(({ key, label }) => (
            <FormControlLabel
              key={key}
              control={
                <Switch
                  checked={prefs.data[key]}
                  disabled={update.isPending}
                  onChange={(event) => update.mutate({ key, value: event.target.checked })}
                />
              }
              label={label(prefs.data)}
            />
          ))}
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
            O alarme de incêndio chega sempre: quem controla é o canal de alarme no próprio celular.
          </Typography>
        </Stack>
      )}
    </SectionCard>
  );
}
