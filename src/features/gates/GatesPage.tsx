import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { errorMessage } from "@/core/api/http";
import { useSession } from "@/core/session/useSession";
import EmptyState from "@/core/ui/components/EmptyState";
import ErrorState from "@/core/ui/components/ErrorState";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import DoorsCard from "./components/DoorsCard";
import GateCard from "./components/GateCard";
import OpenGatePanel from "./components/OpenGatePanel";
import { useDoors, useGateStates, useGates, useGatesRealtime } from "./gatesQueries";

export default function GatesPage() {
  const role = useSession()?.user.role;
  const canManage = role === "sindico" || role === "admin";

  const { gates, list: gatesList } = useGates();
  const { doors, list: doorsList } = useDoors();
  const states = useGateStates(gates.map((gate) => gate.numeroDispositivo));
  const antennasDown = useGatesRealtime();

  return (
    <PageContainer>
      <PageHeader title="Portões e Portas" subtitle="Abertura de portões e portas de pedestre do condomínio." />

      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 3fr) minmax(0, 2fr)" } }}>
        <Stack spacing={3}>
          {gatesList.isPending && <LinearProgress aria-label="Carregando os portões" />}
          {gatesList.isError && (
            <ErrorState description={errorMessage(gatesList.error)} onRetry={() => void gatesList.refetch()} />
          )}
          {gatesList.isSuccess && gates.length === 0 && <EmptyState title="Nenhum portão ativo" />}
          {gates.length > 0 && (
            <>
              {/* key: a lista de portões muda raramente; ao mudar, o painel recomeça com o primeiro selecionado. */}
              <OpenGatePanel key={gates.map((gate) => gate.numeroDispositivo).join(",")} gates={gates} />
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" } }}>
                {gates.map((gate) => (
                  <GateCard
                    key={gate.numeroDispositivo}
                    gate={gate}
                    state={states.get(gate.numeroDispositivo)}
                    antennaDown={antennasDown.has(gate.numeroDispositivo)}
                    canManage={canManage}
                  />
                ))}
              </Box>
            </>
          )}
        </Stack>

        <Box>
          {doorsList.isPending && <LinearProgress aria-label="Carregando as portas" />}
          {doorsList.isError && (
            <ErrorState description={errorMessage(doorsList.error)} onRetry={() => void doorsList.refetch()} />
          )}
          {doorsList.isSuccess && <DoorsCard doors={doors} />}
        </Box>
      </Box>
    </PageContainer>
  );
}
