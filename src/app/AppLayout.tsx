import { Suspense } from "react";
import { Outlet } from "react-router";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import { useResumePush } from "@/core/push/usePush";
import { useRealtimeConnection } from "@/core/realtime/useRealtime";
import { staffRoleOf } from "@/core/session/roles";
import { useSession } from "@/core/session/useSession";
import AppShell from "@/core/ui/layout/AppShell";
import ThemeModeMenu from "@/core/ui/theme/ThemeModeMenu";
import ConnectionIndicator from "./ConnectionIndicator";
import UserMenu from "./UserMenu";
import { navigationFor } from "./navigation";

export default function AppLayout() {
  const session = useSession();
  const role = session ? staffRoleOf(session.user) : null;
  // Liga o tempo real só dentro do painel: telas de login e de senha
  // provisória não têm o que receber.
  useRealtimeConnection();
  useResumePush();

  return (
    <AppShell
      navigation={navigationFor(role)}
      topBarEnd={
        <>
          <ConnectionIndicator />
          <ThemeModeMenu />
          <UserMenu />
        </>
      }
      sidebarFooter={
        <>
          <Typography variant="caption" color="textSecondary" component="p">
            v{import.meta.env.APP_VERSION} ({import.meta.env.BUILD_VERSION})
          </Typography>
          <Typography variant="caption" color="textDisabled" component="p" sx={{ fontSize: "0.625rem", mt: 0.5 }}>
            Desenvolvido por: Flavio Eduardo Tapparo
          </Typography>
        </>
      }
    >
      <Suspense fallback={<LinearProgress aria-label="Carregando a tela" />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}
