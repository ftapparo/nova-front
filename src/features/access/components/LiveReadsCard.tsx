import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useRealtimeStatus } from "@/core/realtime/useRealtime";
import EmptyState from "@/core/ui/components/EmptyState";
import SectionCard from "@/core/ui/components/SectionCard";
import StatusChip from "@/core/ui/components/StatusChip";
import type { Gate } from "@/features/gates/gatesApi";
import type { LiveRead } from "../accessQueries";

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function LiveReadsCard({ reads, gates }: { reads: LiveRead[]; gates: Gate[] }) {
  const realtimeOpen = useRealtimeStatus().state === "open";
  const gateName = (numero: number) => gates.find((gate) => gate.numeroDispositivo === numero)?.nome ?? `Portão ${numero}`;

  return (
    <SectionCard title="Leituras ao vivo" subtitle="Cada TAG lida pelas antenas desde que a tela foi aberta, inclusive as recusadas.">
      {reads.length === 0 ? (
        <EmptyState
          title={realtimeOpen ? "Aguardando leituras" : "Sem tempo real"}
          description={realtimeOpen ? undefined : "As leituras aparecem quando a conexão de tempo real voltar."}
        />
      ) : (
        <List disablePadding aria-label="Leituras ao vivo">
          {reads.map((read) => (
            <ListItem key={read.id} divider disableGutters>
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                    <Typography component="span" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {read.tag}
                    </Typography>
                    <StatusChip label={read.authorized ? "Autorizada" : "Recusada"} tone={read.authorized ? "success" : "error"} />
                  </Stack>
                }
                secondary={`${timeFormat.format(read.receivedAt)} · ${gateName(read.numeroDispositivo)}${read.reason ? ` · ${read.reason}` : ""}`}
              />
            </ListItem>
          ))}
        </List>
      )}
    </SectionCard>
  );
}
