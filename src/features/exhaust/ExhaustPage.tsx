import { useState } from "react";
import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";
import { errorMessage } from "@/core/api/http";
import { useSession } from "@/core/session/useSession";
import EmptyState from "@/core/ui/components/EmptyState";
import ErrorState from "@/core/ui/components/ErrorState";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import ExhaustCard from "./components/ExhaustCard";
import { useExhaustRealtime, useExhausts, useNow } from "./exhaustQueries";

const COUNTDOWN_REFRESH_MS = 30_000;

export default function ExhaustPage() {
  const role = useSession()?.user.role;
  const canManage = role === "sindico" || role === "admin";
  const [onlyOn, setOnlyOn] = useState(false);
  const exhausts = useExhausts();
  const now = useNow(COUNTDOWN_REFRESH_MS);
  useExhaustRealtime();

  const all = [...(exhausts.data ?? [])].sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true }));
  const shown = onlyOn ? all.filter((exhaust) => exhaust.on) : all;
  const towers = [...new Set(shown.map((exhaust) => exhaust.tower))];
  const onCount = all.filter((exhaust) => exhaust.on).length;

  return (
    <PageContainer>
      <PageHeader
        title="Exaustores"
        subtitle="Exaustores das churrasqueiras, um por prumada."
        actions={
          <FormControlLabel
            control={<Switch checked={onlyOn} onChange={(event) => setOnlyOn(event.target.checked)} />}
            label={`Só ligados (${onCount})`}
          />
        }
      />

      {exhausts.isPending && <LinearProgress aria-label="Carregando os exaustores" />}
      {exhausts.isError && <ErrorState description={errorMessage(exhausts.error)} onRetry={() => void exhausts.refetch()} />}
      {exhausts.isSuccess && shown.length === 0 && (
        <EmptyState title={onlyOn ? "Nenhum exaustor ligado" : "Nenhum exaustor cadastrado"} />
      )}

      {towers.map((tower) => (
        <Stack key={tower} spacing={1.5} component="section" aria-label={`Torre ${tower}`}>
          <Typography variant="h2">Torre {tower}</Typography>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" },
            }}
          >
            {shown
              .filter((exhaust) => exhaust.tower === tower)
              .map((exhaust) => (
                <ExhaustCard key={exhaust.id} exhaust={exhaust} now={now} canManage={canManage} />
              ))}
          </Box>
        </Stack>
      ))}
    </PageContainer>
  );
}
