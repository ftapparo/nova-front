import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSession } from "@/core/session/useSession";
import AuthLayout from "./components/AuthLayout";
import SignOutButton from "./components/SignOutButton";

/** Conta válida, mas sem papel de equipe: este painel não é para ela. */
export default function StaffOnlyPage() {
  const session = useSession();

  return (
    <AuthLayout title="Painel de uso da equipe" subtitle={session?.user.email ?? undefined}>
      <Stack spacing={2} sx={{ alignItems: "center", textAlign: "center" }}>
        <Typography>
          Este painel é usado pela portaria e pela administração do condomínio. Como morador, acesse pelo aplicativo
          Nova Residence.
        </Typography>
        <SignOutButton />
      </Stack>
    </AuthLayout>
  );
}
