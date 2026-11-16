import { useState, type FormEvent } from "react";
import { Link as RouterLink } from "react-router";
import { useMutation } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { errorMessage } from "@/core/api/http";
import { formatCpf, onlyDigits } from "@/core/format/documents";
import { erpText, joinErpText } from "@/core/format/erpText";
import { useSession } from "@/core/session/useSession";
import PageContainer from "@/core/ui/layout/PageContainer";
import PageHeader from "@/core/ui/layout/PageHeader";
import { queryCpf, relationLabel } from "@/features/registry/queriesApi";
import { resetPersonPassword } from "./accountsApi";
import ResetPasswordDialog from "./components/ResetPasswordDialog";

/**
 * Reset de senha pela portaria: parte do CPF do morador, porque o porteiro
 * não lista contas. Reseta a conta vinculada à pessoa; contas da equipe
 * ficam na tela Contas (síndico/admin).
 */
export default function ResetPasswordPage() {
  const role = useSession()?.user.role;
  const canManageAccounts = role === "sindico" || role === "admin";
  const [cpf, setCpf] = useState("");
  const [confirming, setConfirming] = useState(false);

  const search = useMutation({ mutationFn: (target: string) => queryCpf(target) });
  const person = search.data?.exists ? search.data.person : null;
  const name = person ? (erpText(person.nome) ?? "Sem nome no cadastro") : "";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (cpf.length === 11) search.mutate(cpf);
  };

  return (
    <PageContainer>
      <PageHeader title="Reset de senha" subtitle="Gera uma senha provisória para o morador entrar no aplicativo e trocar a senha." />

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack component="form" direction="row" spacing={1} onSubmit={submit} noValidate>
              <TextField
                label="CPF do morador"
                value={formatCpf(cpf)}
                onChange={(event) => {
                  setCpf(onlyDigits(event.target.value).slice(0, 11));
                  search.reset();
                }}
                slotProps={{ htmlInput: { inputMode: "numeric", autoComplete: "off" } }}
                sx={{ flexGrow: 1, maxWidth: 360 }}
                autoFocus
              />
              <Button type="submit" variant="contained" loading={search.isPending} disabled={cpf.length !== 11}>
                Buscar
              </Button>
            </Stack>
            {canManageAccounts && (
              <Typography variant="body2" color="textSecondary">
                Para contas da equipe, use a tela{" "}
                <Link component={RouterLink} to="/contas">
                  Contas
                </Link>
                .
              </Typography>
            )}

            {search.isError && <Alert severity="error">{errorMessage(search.error)}</Alert>}
            {search.isSuccess && !person && <Alert severity="warning">Nenhuma pessoa com este CPF no cadastro.</Alert>}
            {person && (
              <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: "action.hover" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                  <div>
                    <Typography sx={{ fontWeight: 600 }}>{name}</Typography>
                    {(search.data?.links ?? []).map((item) => (
                      <Typography key={item.pessoaVinculo.sequencia} variant="body2" color="textSecondary">
                        {joinErpText([item.unidade.quadra, item.unidade.lote], "-") || "Unidade"} · {relationLabel(item.pessoaVinculo)}
                      </Typography>
                    ))}
                  </div>
                  <Button variant="outlined" color="error" onClick={() => setConfirming(true)}>
                    Resetar senha
                  </Button>
                </Stack>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {confirming && person && (
        <ResetPasswordDialog
          targetLabel={name}
          reset={() => resetPersonPassword(person.sequencia)}
          onClose={() => setConfirming(false)}
        />
      )}
    </PageContainer>
  );
}
