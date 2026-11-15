import { useEffect, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { staffRoleOf, type StaffRole } from "@/core/session/roles";
import { reloadSessionUser } from "@/core/session/sessionActions";
import { useSession } from "@/core/session/useSession";
import EmptyState from "@/core/ui/components/EmptyState";
import PageContainer from "@/core/ui/layout/PageContainer";
import StaffOnlyPage from "@/features/auth/StaffOnlyPage";

// Só caminho interno vale como destino pós-login: o state da navegação não
// pode virar redirecionamento para fora do painel.
const safeReturnPath = (state: unknown): string => {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/";
};

/** Rotas de quem ainda não entrou (login, recuperar senha). */
export function PublicOnly() {
  const session = useSession();
  const location = useLocation();

  if (session) return <Navigate to={safeReturnPath(location.state)} replace />;
  return <Outlet />;
}

/** Exige sessão; sem ela vai para o login guardando de onde veio. */
export function RequireSession() {
  const session = useSession();
  const location = useLocation();
  const signedIn = Boolean(session);

  useEffect(() => {
    if (!signedIn) return;
    // Papel e pendências guardados no navegador podem estar velhos (a equipe
    // pode ter mudado o papel ou resetado a senha). Se a releitura falhar, o
    // painel segue com o que tem e cada tela mostra o próprio erro.
    reloadSessionUser().catch(() => {});
  }, [signedIn]);

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Resolve as pendências da conta antes de liberar o painel da equipe. */
export function RequireStaff() {
  const session = useSession();
  if (!session) return null;

  // Com senha provisória a API recusa todo o resto, então a troca vem antes.
  // `mustAcceptTerms` é ignorado de propósito: o Termo de Uso e a Política
  // são do aplicativo dos moradores, não do painel interno da equipe.
  if (session.user.mustChangePassword) return <Navigate to="/trocar-senha" replace />;
  if (!staffRoleOf(session.user)) return <StaffOnlyPage />;
  return <Outlet />;
}

/** Esconde a tela de quem não tem o papel. O servidor segue sendo a autoridade. */
export function RequireRole({ roles, children }: { roles: readonly StaffRole[]; children: ReactNode }) {
  const session = useSession();
  const role = session ? staffRoleOf(session.user) : null;

  if (!role || !roles.includes(role)) {
    return (
      <PageContainer>
        <EmptyState title="Acesso negado" description="Seu perfil não tem acesso a esta área do painel." />
      </PageContainer>
    );
  }
  return children;
}
