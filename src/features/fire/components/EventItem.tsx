import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import StatusChip from "@/core/ui/components/StatusChip";
import { placeLabel, SEVERITY_TONE, type CieLog } from "../fireApi";

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" });

const KIND_LABEL: Record<CieLog["event"]["kind"], string> = {
  ativacao: "Ocorrência",
  restauracao: "Normalizado",
  estado: "Estado",
  informativo: "Registro",
};

/** Um evento da central. Só exibe campos que a API já interpretou. */
export default function EventItem({ log }: { log: CieLog }) {
  const { event, display } = log;
  const tone = SEVERITY_TONE[event.severity];
  const place = placeLabel(display.place);
  const device = [display.device, display.deviceName].filter(Boolean).join(" · ");
  const location = [
    place,
    display.zoneName ? `Zona ${display.zone ?? ""} ${display.zoneName}`.replace(/\s+/g, " ").trim() : null,
    display.rule ? `Regra ${display.rule.id}${display.rule.name ? ` ${display.rule.name}` : ""}` : null,
    display.loop !== null && display.address !== null ? `Laço ${display.loop} · endereço ${display.address}` : null,
  ].filter(Boolean);
  const occurredAt = new Date(log.occurredAt);

  return (
    <Box
      sx={(theme) => ({
        borderLeft: 4,
        borderColor: theme.vars.palette.soft[tone].border,
        pl: 1.5,
        py: 1,
      })}
    >
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 600 }}>{display.title || event.label}</Typography>
          {device && (
            <Typography variant="body2" color="textSecondary">
              {device}
            </Typography>
          )}
          {location.length > 0 && (
            <Typography variant="body2" color="textSecondary">
              {location.join(" · ")}
            </Typography>
          )}
          <Typography variant="caption" color="textSecondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {Number.isNaN(occurredAt.getTime()) ? log.occurredAt : dateTimeFormat.format(occurredAt)}
          </Typography>
        </Box>
        <StatusChip label={KIND_LABEL[event.kind]} tone={event.kind === "restauracao" ? "success" : tone} />
      </Stack>
    </Box>
  );
}
