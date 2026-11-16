import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tabs from "@mui/material/Tabs";
import TextField from "@mui/material/TextField";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { errorMessage } from "@/core/api/http";
import { staffRoleOf } from "@/core/session/roles";
import ConfirmDialog from "@/core/ui/components/ConfirmDialog";
import EmptyState from "@/core/ui/components/EmptyState";
import ErrorState from "@/core/ui/components/ErrorState";
import StatusChip from "@/core/ui/components/StatusChip";
import { useNotify } from "@/core/ui/components/useNotify";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import { allAccountsQuery, type Account } from "@/features/accounts/accountsApi";
import LinkAccountDialog from "./components/LinkAccountDialog";
import { fetchLinks, isSelfLink, unlinkAccount, type AccountLink } from "./linksApi";

const LINKS_KEY = ["residence", "links"] as const;
const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

type View = "linked" | "pending";
type OpenDialog = { kind: "link"; account: Account } | { kind: "unlink"; link: AccountLink; email: string } | null;

export default function LinksPage() {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("pending");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());
  const [dialog, setDialog] = useState<OpenDialog>(null);

  const links = useQuery({ queryKey: LINKS_KEY, queryFn: ({ signal }) => fetchLinks(signal) });
  const accounts = useQuery(allAccountsQuery);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: LINKS_KEY });

  const unlink = useMutation({
    mutationFn: (accountId: string) => unlinkAccount(accountId),
    onSuccess: () => {
      notify.success("Vínculo removido.");
      refresh();
      setDialog(null);
    },
    onError: (error) => notify.error(errorMessage(error)),
  });

  const emailOf = new Map((accounts.data ?? []).map((account) => [account.id, account.email ?? account.id]));
  const linkedIds = new Set((links.data ?? []).map((link) => link.accountId));
  const matches = (email: string) => !deferredSearch || email.toLowerCase().includes(deferredSearch);

  const linkedRows = (links.data ?? [])
    .map((link) => ({ link, email: emailOf.get(link.accountId) ?? "Conta excluída ou não encontrada" }))
    .filter(({ email }) => matches(email))
    .sort((a, b) => b.link.linkedAt.localeCompare(a.link.linkedAt));
  // Pendentes: contas sem vínculo e sem papel de equipe (equipe não precisa de vínculo).
  const pendingRows = (accounts.data ?? [])
    .filter((account) => !linkedIds.has(account.id) && !staffRoleOf(account))
    .filter((account) => matches(account.email ?? ""))
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  const pending = links.isPending || accounts.isPending;
  const error = links.error ?? accounts.error;

  return (
    <PageContainer>
      <PageHeader title="Vínculos" subtitle="Ligação entre a conta do aplicativo e o cadastro do morador no condomínio." />

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Tabs value={view} onChange={(_event, next: View) => setView(next)}>
          <Tab value="pending" label={accounts.isSuccess && links.isSuccess ? `Sem vínculo (${pendingRows.length})` : "Sem vínculo"} />
          <Tab value="linked" label={links.isSuccess ? `Vinculadas (${linkedRows.length})` : "Vinculadas"} />
        </Tabs>
        <TextField
          size="small"
          placeholder="Buscar por e-mail"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment> },
            htmlInput: { "aria-label": "Buscar por e-mail" },
          }}
        />
      </Stack>

      {pending && <LinearProgress aria-label="Carregando os vínculos" />}
      {!pending && error && (
        <ErrorState
          description={errorMessage(error)}
          onRetry={() => {
            void links.refetch();
            void accounts.refetch();
          }}
        />
      )}

      {!pending && !error && view === "pending" && (
        pendingRows.length === 0 ? (
          <EmptyState title="Nenhuma conta sem vínculo" description="Moradores que se vinculam pelo aplicativo não aparecem aqui." />
        ) : (
          <Card>
            <TableContainer>
              <Table size="small" aria-label="Contas sem vínculo">
                <TableHead>
                  <TableRow>
                    <TableCell>E-mail</TableCell>
                    <TableCell>Criada em</TableCell>
                    <TableCell align="right">Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingRows.map((account) => (
                    <TableRow key={account.id} hover>
                      <TableCell>{account.email ?? "—"}</TableCell>
                      <TableCell>{account.createdAt ? dateFormat.format(new Date(account.createdAt)) : "—"}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => setDialog({ kind: "link", account })}>
                          Vincular
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        )
      )}

      {!pending && !error && view === "linked" && (
        linkedRows.length === 0 ? (
          <EmptyState title="Nenhum vínculo" />
        ) : (
          <Card>
            <TableContainer>
              <Table size="small" aria-label="Contas vinculadas">
                <TableHead>
                  <TableRow>
                    <TableCell>Conta</TableCell>
                    <TableCell>Cadastro nº</TableCell>
                    <TableCell>Feito por</TableCell>
                    <TableCell>Em</TableCell>
                    <TableCell align="right">Ação</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {linkedRows.map(({ link, email }) => (
                    <TableRow key={link.accountId} hover>
                      <TableCell>{email}</TableCell>
                      <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>{link.personSequencia}</TableCell>
                      <TableCell>
                        {isSelfLink(link) ? (
                          <StatusChip label="O próprio morador" tone="info" />
                        ) : (
                          emailOf.get(link.linkedBy) ?? "Equipe"
                        )}
                      </TableCell>
                      <TableCell>{dateFormat.format(new Date(link.linkedAt))}</TableCell>
                      <TableCell align="right">
                        <Button size="small" color="error" onClick={() => setDialog({ kind: "unlink", link, email })}>
                          Remover
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        )
      )}

      {dialog?.kind === "link" && <LinkAccountDialog account={dialog.account} onLinked={refresh} onClose={() => setDialog(null)} />}
      <ConfirmDialog
        open={dialog?.kind === "unlink"}
        tone="danger"
        title="Remover vínculo"
        description={
          dialog?.kind === "unlink"
            ? `A conta ${dialog.email} perde o acesso de morador no aplicativo (exaustor, comunicados, central de incêndio) até ser vinculada de novo.`
            : ""
        }
        confirmLabel="Remover vínculo"
        loading={unlink.isPending}
        onConfirm={() => dialog?.kind === "unlink" && unlink.mutate(dialog.link.accountId)}
        onClose={() => setDialog(null)}
      />
    </PageContainer>
  );
}
