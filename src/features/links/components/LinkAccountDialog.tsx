import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { errorMessage } from "@/core/api/http";
import { formatCpf, onlyDigits } from "@/core/format/documents";
import { erpText, joinErpText } from "@/core/format/erpText";
import { useNotify } from "@/core/ui/components/useNotify";
import type { Account } from "@/features/accounts/accountsApi";
import { queryCpf, relationLabel, type CpfQuery } from "@/features/registry/queriesApi";
import { linkAccount } from "../linksApi";

interface LinkAccountDialogProps {
  account: Account;
  onLinked: () => void;
  onClose: () => void;
}

/**
 * Liga a conta ao cadastro da pessoa: busca pelo CPF, mostra nome e
 * unidades para conferir e só então grava. O resultado da busca fica só
 * neste diálogo.
 */
export default function LinkAccountDialog({ account, onLinked, onClose }: LinkAccountDialogProps) {
  const notify = useNotify();
  const [cpf, setCpf] = useState("");

  const search = useMutation({ mutationFn: (target: string) => queryCpf(target) });
  const person: CpfQuery["person"] = search.data?.exists ? search.data.person : null;

  const link = useMutation({
    mutationFn: (personSequencia: number) => linkAccount(account.id, personSequencia),
    onSuccess: () => {
      notify.success("Conta vinculada ao cadastro.");
      onLinked();
      onClose();
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (cpf.length === 11) search.mutate(cpf);
  };

  const busy = search.isPending || link.isPending;

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Vincular conta</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText>
            Conta <strong>{account.email}</strong>. Informe o CPF da pessoa no cadastro do condomínio.
          </DialogContentText>
          <Stack component="form" direction="row" spacing={1} onSubmit={submit} noValidate>
            <TextField
              label="CPF"
              value={formatCpf(cpf)}
              onChange={(event) => {
                setCpf(onlyDigits(event.target.value).slice(0, 11));
                search.reset();
                link.reset();
              }}
              slotProps={{ htmlInput: { inputMode: "numeric", autoComplete: "off" } }}
              sx={{ flexGrow: 1 }}
              autoFocus
            />
            <Button type="submit" variant="outlined" loading={search.isPending} disabled={cpf.length !== 11 || link.isPending}>
              Buscar
            </Button>
          </Stack>

          {search.isError && <Alert severity="error">{errorMessage(search.error)}</Alert>}
          {search.isSuccess && !person && <Alert severity="warning">Nenhuma pessoa com este CPF no cadastro.</Alert>}
          {person && (
            <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: "action.hover" }}>
              <Typography sx={{ fontWeight: 600 }}>{erpText(person.nome) ?? "Sem nome no cadastro"}</Typography>
              <Typography variant="body2" color="textSecondary">
                Cadastro nº {person.sequencia}
              </Typography>
              {(search.data?.links ?? []).map((item) => (
                <Typography key={item.pessoaVinculo.sequencia} variant="body2" color="textSecondary">
                  {joinErpText([item.unidade.quadra, item.unidade.lote], "-") || "Unidade"} · {relationLabel(item.pessoaVinculo)}
                </Typography>
              ))}
              {(search.data?.links ?? []).length === 0 && (
                <Typography variant="body2" color="warning.main">
                  Sem unidade no cadastro: a conta fica vinculada, mas sem acesso de morador.
                </Typography>
              )}
            </Box>
          )}
          {link.isError && <Alert severity="error">{errorMessage(link.error)}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="contained" loading={link.isPending} disabled={!person || search.isPending} onClick={() => person && link.mutate(person.sequencia)}>
          Vincular a esta pessoa
        </Button>
      </DialogActions>
    </Dialog>
  );
}
