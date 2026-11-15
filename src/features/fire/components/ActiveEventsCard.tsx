import { useState } from "react";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { errorMessage } from "@/core/api/http";
import EmptyState from "@/core/ui/components/EmptyState";
import ErrorState from "@/core/ui/components/ErrorState";
import SectionCard from "@/core/ui/components/SectionCard";
import type { BlockCounters } from "../fireApi";
import { useActiveEvents, useBlockCounters } from "../fireQueries";
import EventItem from "./EventItem";

type ActiveTab = "alarme" | "falha" | "supervisao" | "bloqueio";

const TABS: { value: ActiveTab; label: string }[] = [
  { value: "alarme", label: "Alarme" },
  { value: "falha", label: "Falha" },
  { value: "supervisao", label: "Supervisão" },
  { value: "bloqueio", label: "Bloqueio" },
];

const BLOCK_LABELS: { key: keyof BlockCounters; label: string }[] = [
  { key: "dispositivo", label: "Dispositivos" },
  { key: "sirene", label: "Sirenes" },
  { key: "saida", label: "Saídas" },
  { key: "atuador", label: "Atuadores" },
  { key: "regra", label: "Regras" },
  { key: "zona", label: "Zonas" },
  { key: "laco", label: "Laços" },
];

// A central não fornece a lista de bloqueios, só contagens por tipo.
function BlocksSummary() {
  const blocks = useBlockCounters(true);
  if (blocks.isPending) return <LinearProgress aria-label="Carregando os bloqueios" />;
  if (blocks.isError) return <ErrorState description={errorMessage(blocks.error)} onRetry={() => void blocks.refetch()} />;
  const items = BLOCK_LABELS.filter(({ key }) => (blocks.data[key] ?? 0) > 0);
  if (items.length === 0) return <EmptyState title="Nada bloqueado na central" />;
  return (
    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 3, py: 1 }}>
      {items.map(({ key, label }) => (
        <Box key={key}>
          <Typography variant="h4" component="p">
            {blocks.data[key]}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {label}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

/** O que está ativo agora na central, por tipo. */
export default function ActiveEventsCard() {
  const [tab, setTab] = useState<ActiveTab>("alarme");
  const active = useActiveEvents();
  const counters = active.data?.counters;

  return (
    <SectionCard title="Ativos agora" subtitle="Eventos em andamento na central.">
      <Tabs value={tab} onChange={(_event, value: ActiveTab) => setTab(value)} variant="scrollable" sx={{ mb: 1 }}>
        {TABS.map(({ value, label }) => (
          <Tab key={value} value={value} label={counters ? `${label} (${counters[value]})` : label} />
        ))}
      </Tabs>

      {tab === "bloqueio" ? (
        <BlocksSummary />
      ) : (
        <>
          {active.isPending && <LinearProgress aria-label="Carregando os eventos ativos" />}
          {active.isError && <ErrorState description={errorMessage(active.error)} onRetry={() => void active.refetch()} />}
          {active.isSuccess && (active.data.events[tab] ?? []).length === 0 && <EmptyState title="Nenhum evento ativo" />}
          {active.isSuccess && (
            <Stack spacing={1} divider={<Box sx={{ borderBottom: 1, borderColor: "divider" }} />}>
              {(active.data.events[tab] ?? []).map((log) => (
                <EventItem key={log.key} log={log} />
              ))}
            </Stack>
          )}
        </>
      )}
    </SectionCard>
  );
}
