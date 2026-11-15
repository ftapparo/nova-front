import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { errorMessage } from "@/core/api/http";
import EmptyState from "@/core/ui/components/EmptyState";
import ErrorState from "@/core/ui/components/ErrorState";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import LiveReadsCard from "./components/LiveReadsCard";
import RecentAccessCard from "./components/RecentAccessCard";
import VerifyAccessCard from "./components/VerifyAccessCard";
import { useActiveGates, useLiveTagReads } from "./accessQueries";

export default function AccessPage() {
  const { gates, query } = useActiveGates();
  // Fora do if: as leituras começam a ser guardadas assim que a tela abre.
  const liveReads = useLiveTagReads();

  return (
    <PageContainer>
      <PageHeader title="Acessos" subtitle="Passagens pelos portões e conferência de credenciais." />

      {query.isPending && <LinearProgress aria-label="Carregando os portões" />}
      {query.isError && <ErrorState description={errorMessage(query.error)} onRetry={() => void query.refetch()} />}
      {query.isSuccess && gates.length === 0 && <EmptyState title="Nenhum portão ativo" />}

      {gates.length > 0 && (
        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 2fr) minmax(0, 1fr)" } }}>
          <RecentAccessCard gates={gates} />
          <Stack spacing={3}>
            <VerifyAccessCard key={gates.map((gate) => gate.numeroDispositivo).join(",")} gates={gates} />
            <LiveReadsCard reads={liveReads} gates={gates} />
          </Stack>
        </Box>
      )}
    </PageContainer>
  );
}
