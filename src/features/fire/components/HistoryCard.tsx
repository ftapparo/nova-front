import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { errorMessage } from "@/core/api/http";
import EmptyState from "@/core/ui/components/EmptyState";
import ErrorState from "@/core/ui/components/ErrorState";
import SectionCard from "@/core/ui/components/SectionCard";
import type { LogType } from "../fireApi";
import { useLogs } from "../fireQueries";
import EventItem from "./EventItem";

const TABS: { value: LogType; label: string }[] = [
  { value: "alarme", label: "Alarme" },
  { value: "falha", label: "Falha" },
  { value: "supervisao", label: "Supervisão" },
  { value: "operacao", label: "Operação" },
  { value: "bloqueio", label: "Bloqueio" },
];

/** Histórico gravado na central, paginado por cursor. */
export default function HistoryCard() {
  const [type, setType] = useState<LogType>("alarme");
  const [onlyOccurrences, setOnlyOccurrences] = useState(false);
  const logs = useLogs(type, onlyOccurrences);
  const items = logs.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <SectionCard
      title="Histórico"
      subtitle="Registro da central, do mais recente para o mais antigo."
      action={
        <FormControlLabel
          control={<Switch checked={onlyOccurrences} onChange={(event) => setOnlyOccurrences(event.target.checked)} />}
          label="Só ocorrências"
        />
      }
    >
      <Tabs value={type} onChange={(_event, value: LogType) => setType(value)} variant="scrollable" sx={{ mb: 1 }}>
        {TABS.map(({ value, label }) => (
          <Tab key={value} value={value} label={label} />
        ))}
      </Tabs>

      {logs.isPending && <LinearProgress aria-label="Carregando o histórico" />}
      {logs.isError && <ErrorState description={errorMessage(logs.error)} onRetry={() => void logs.refetch()} />}
      {logs.isSuccess && items.length === 0 && <EmptyState title="Nenhum registro" />}
      {items.length > 0 && (
        <Stack spacing={1} divider={<Box sx={{ borderBottom: 1, borderColor: "divider" }} />}>
          {items.map((log) => (
            <EventItem key={log.key} log={log} />
          ))}
        </Stack>
      )}
      {logs.hasNextPage && (
        <Stack sx={{ alignItems: "center", mt: 2 }}>
          <Button onClick={() => void logs.fetchNextPage()} loading={logs.isFetchingNextPage}>
            Carregar mais
          </Button>
        </Stack>
      )}
    </SectionCard>
  );
}
