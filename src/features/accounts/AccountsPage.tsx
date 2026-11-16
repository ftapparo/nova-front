import { useState } from "react";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import AddOutlined from "@mui/icons-material/AddOutlined";
import { errorMessage } from "@/core/api/http";
import { staffRoleOf } from "@/core/session/roles";
import { useSession } from "@/core/session/useSession";
import ConfirmDialog from "@/core/ui/components/ConfirmDialog";
import EmptyState from "@/core/ui/components/EmptyState";
import ErrorState from "@/core/ui/components/ErrorState";
import StatusChip from "@/core/ui/components/StatusChip";
import { useNotify } from "@/core/ui/components/useNotify";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import { ACCOUNTS_PER_PAGE, resetAccountPassword, type Account } from "./accountsApi";
import { canManageAccount, grantableRoles, roleLabel } from "./accountRules";
import { useAccounts, useDeleteAccount } from "./accountsQueries";
import AccountActionsMenu, { type AccountAction } from "./components/AccountActionsMenu";
import ChangeRoleDialog from "./components/ChangeRoleDialog";
import CreateAccountDialog from "./components/CreateAccountDialog";
import ResetPasswordDialog from "./components/ResetPasswordDialog";

const formatDate = (iso: string | undefined) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

type OpenDialog = { kind: "create" } | { kind: AccountAction; account: Account } | null;

export default function AccountsPage() {
  const session = useSession();
  const notify = useNotify();
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const accounts = useAccounts(page);
  const remove = useDeleteAccount();

  if (!session) return null;
  const me = session.user;
  const roles = grantableRoles(me.role);
  const closeDialog = () => setDialog(null);

  const confirmDelete = (account: Account) =>
    remove.mutate(account.id, {
      onSuccess: () => {
        notify.success(`Conta ${account.email ?? ""} excluída.`);
        closeDialog();
      },
      // O diálogo fecha e o motivo vai no aviso: a recusa (403/404) não muda com nova tentativa.
      onError: (error) => {
        notify.error(errorMessage(error));
        closeDialog();
      },
    });

  return (
    <PageContainer>
      <PageHeader
        title="Contas"
        subtitle="Contas de acesso ao painel e ao aplicativo."
        actions={
          <Button variant="contained" startIcon={<AddOutlined />} onClick={() => setDialog({ kind: "create" })}>
            Nova conta
          </Button>
        }
      />

      {accounts.isPending && <LinearProgress aria-label="Carregando as contas" />}
      {accounts.isError && <ErrorState description={errorMessage(accounts.error)} onRetry={() => void accounts.refetch()} />}

      {accounts.isSuccess && accounts.data.length === 0 && (
        <EmptyState title={page === 1 ? "Nenhuma conta cadastrada" : "Não há mais contas"} />
      )}

      {accounts.isSuccess && accounts.data.length > 0 && (
        <Card>
          <TableContainer>
            <Table size="small" aria-label="Contas">
              <TableHead>
                <TableRow>
                  <TableCell>E-mail</TableCell>
                  <TableCell>Perfil</TableCell>
                  <TableCell>Criada em</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.data.map((account) => (
                  <TableRow key={account.id} hover>
                    <TableCell>
                      {account.email ?? "—"}
                      {account.id === me.id && (
                        <Typography component="span" variant="caption" color="textSecondary">
                          {" "}
                          (você)
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <StatusChip label={roleLabel(account.role)} tone={staffRoleOf(account) ? "info" : "neutral"} />
                        {account.mustChangePassword && <StatusChip label="Senha provisória" tone="warning" />}
                      </Stack>
                    </TableCell>
                    <TableCell>{formatDate(account.createdAt)}</TableCell>
                    <TableCell align="right">
                      {canManageAccount(me, account) && (
                        <AccountActionsMenu
                          email={account.email}
                          onAction={(kind) => setDialog({ kind, account })}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* A API não informa o total: a página cheia é o único sinal de que pode haver mais. */}
      {accounts.isSuccess && (page > 1 || accounts.data.length === ACCOUNTS_PER_PAGE) && (
        <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", alignItems: "center" }}>
          <Typography variant="body2" color="textSecondary">
            Página {page}
          </Typography>
          <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
            Anterior
          </Button>
          <Button disabled={accounts.data.length < ACCOUNTS_PER_PAGE} onClick={() => setPage(page + 1)}>
            Próxima
          </Button>
        </Stack>
      )}

      {dialog?.kind === "create" && <CreateAccountDialog roles={roles} onClose={closeDialog} />}
      {dialog?.kind === "reset-password" && (
        <ResetPasswordDialog
          targetLabel={dialog.account.email ?? "a conta"}
          reset={() => resetAccountPassword(dialog.account.id)}
          onClose={closeDialog}
        />
      )}
      {dialog?.kind === "change-role" && <ChangeRoleDialog account={dialog.account} roles={roles} onClose={closeDialog} />}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          open
          tone="danger"
          title="Excluir conta"
          description={
            <>
              A conta <strong>{dialog.account.email}</strong> perde o acesso ao painel e ao aplicativo, e o vínculo com
              o cadastro, as preferências e os aparelhos registrados são apagados. Não dá para desfazer.
            </>
          }
          confirmLabel="Excluir conta"
          loading={remove.isPending}
          onConfirm={() => confirmDelete(dialog.account)}
          onClose={closeDialog}
        />
      )}
    </PageContainer>
  );
}
