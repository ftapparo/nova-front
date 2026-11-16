import { Link as RouterLink } from "react-router";
import { useMutation } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useColorScheme } from "@mui/material/styles";
import PushBrowserCard from "@/core/push/PushBrowserCard";
import { STAFF_ROLE_LABEL, staffRoleOf } from "@/core/session/roles";
import { signOut } from "@/core/session/sessionActions";
import { useSession } from "@/core/session/useSession";
import SectionCard from "@/core/ui/components/SectionCard";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import AppPreferencesCard from "./components/AppPreferencesCard";

const MODES = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
] as const;

export default function AccountPage() {
  const session = useSession();
  const { mode, setMode } = useColorScheme();
  const logout = useMutation({ mutationFn: signOut });
  if (!session) return null;
  const role = staffRoleOf(session.user);

  return (
    <PageContainer>
      <PageHeader title="Minha conta" />
      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" } }}>
        <Stack spacing={3}>
          <SectionCard title="Conta">
            <Stack spacing={2}>
              <div>
                <Typography sx={{ fontWeight: 600 }}>{session.user.email}</Typography>
                <Typography variant="body2" color="textSecondary">
                  Perfil: {role ? STAFF_ROLE_LABEL[role] : "—"}
                </Typography>
              </div>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" component={RouterLink} to="/trocar-senha">
                  Trocar senha
                </Button>
                <Button color="inherit" loading={logout.isPending} onClick={() => logout.mutate()}>
                  Sair
                </Button>
              </Stack>
            </Stack>
          </SectionCard>

          <SectionCard title="Aparência" subtitle="Vale para este navegador.">
            <ToggleButtonGroup
              exclusive
              value={mode ?? "system"}
              onChange={(_event, value: (typeof MODES)[number]["value"] | null) => value && setMode(value)}
              aria-label="Tema"
            >
              {MODES.map(({ value, label }) => (
                <ToggleButton key={value} value={value}>
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </SectionCard>
        </Stack>

        <Stack spacing={3}>
          <PushBrowserCard />
          <AppPreferencesCard />
        </Stack>
      </Box>
    </PageContainer>
  );
}
