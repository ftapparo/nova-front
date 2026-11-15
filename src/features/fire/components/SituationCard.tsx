import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import LocalFireDepartmentOutlined from "@mui/icons-material/LocalFireDepartmentOutlined";
import StatusChip from "@/core/ui/components/StatusChip";
import { SEVERITY_TONE, type Panel } from "../fireApi";

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" });

const COUNTERS = [
  { key: "alarme", label: "Alarme" },
  { key: "falha", label: "Falha" },
  { key: "supervisao", label: "Supervisão" },
  { key: "bloqueio", label: "Bloqueio" },
] as const;

/** Manchete da central: a `situation` que a API já calculou, mais os contadores. */
export default function SituationCard({ panel }: { panel: Panel }) {
  const { situation } = panel;
  const tone = SEVERITY_TONE[situation.severity];

  return (
    <Card
      sx={(theme) => ({
        borderColor: theme.vars.palette.soft[tone].border,
        bgcolor: theme.vars.palette.soft[tone].bg,
      })}
    >
      <CardContent>
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} sx={{ justifyContent: "space-between" }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <Box
              sx={(theme) => ({ color: theme.vars.palette.soft[tone].fg, display: "flex" })}
              aria-hidden
            >
              <LocalFireDepartmentOutlined sx={{ fontSize: 48 }} />
            </Box>
            <div>
              <Typography
                variant="h1"
                component="p"
                role="status"
                sx={(theme) => ({ color: theme.vars.palette.soft[tone].fg })}
              >
                {situation.label}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {[panel.central.nome, panel.central.modelo].filter(Boolean).join(" · ") || "Central de incêndio"}
                {panel.dataHora ? ` · relógio da central ${dateTimeFormat.format(panel.dataHora.timestamp)}` : ""}
              </Typography>
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 1 }}>
                {situation.silenced && <StatusChip label="Silenciada" tone="warning" />}
                {panel.restarting && <StatusChip label="Reiniciando" tone="warning" />}
                {panel.reconnecting && <StatusChip label={`Reconectando (tentativa ${panel.reconnectAttempt})`} tone="warning" />}
                {panel.counters && panel.counters.regrasTemporizando > 0 && (
                  <StatusChip label={`${panel.counters.regrasTemporizando} regra(s) temporizando`} tone="warning" />
                )}
              </Stack>
            </div>
          </Stack>

          {panel.counters && (
            <Stack direction="row" spacing={3} sx={{ alignItems: "center" }} aria-label="Contadores da central">
              {COUNTERS.map(({ key, label }) => (
                <Box key={key} sx={{ textAlign: "center", minWidth: 64 }}>
                  <Typography variant="h4" component="p">
                    {panel.counters?.[key] ?? 0}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {label}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Stack>
        {panel.lastError && (
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            Último erro de comunicação: {panel.lastError}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
