import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import { errorMessage } from "@/core/api/http";
import { useSession } from "@/core/session/useSession";
import ErrorState from "@/core/ui/components/ErrorState";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import ActiveEventsCard from "./components/ActiveEventsCard";
import AdminDeviceCommandsCard from "./components/AdminDeviceCommandsCard";
import CommandsCard from "./components/CommandsCard";
import HistoryCard from "./components/HistoryCard";
import InstallationCard from "./components/InstallationCard";
import SituationCard from "./components/SituationCard";
import { useFireRealtime, useInstallation, usePanel } from "./fireQueries";

export default function FirePage() {
  const panel = usePanel();
  const isAdmin = useSession()?.user.role === "admin";
  const installation = useInstallation();
  useFireRealtime();

  return (
    <PageContainer>
      <PageHeader title="Central de Incêndio" subtitle="Situação, eventos e comandos da central de alarme de incêndio." />

      {panel.isPending && <LinearProgress aria-label="Carregando a central" />}
      {panel.isError && <ErrorState description={errorMessage(panel.error)} onRetry={() => void panel.refetch()} />}

      {panel.isSuccess && (
        <>
          <SituationCard panel={panel.data} />
          <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 3fr) minmax(0, 2fr)" } }}>
            <ActiveEventsCard />
            <Stack spacing={3}>
              <CommandsCard panel={panel.data} />
              {isAdmin && installation.data && <AdminDeviceCommandsCard installation={installation.data} />}
            </Stack>
          </Box>
          <HistoryCard />
          <InstallationCard />
        </>
      )}
    </PageContainer>
  );
}
