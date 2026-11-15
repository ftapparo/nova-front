import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ApiError, errorMessage } from "@/core/api/http";
import SectionCard from "@/core/ui/components/SectionCard";
import StatusChip from "@/core/ui/components/StatusChip";
import { gateSentido, type Gate } from "@/features/gates/gatesApi";
import { isAccessAllowed, verifyAccess } from "../accessApi";
import { unitLabel } from "../accessFormat";

/**
 * Consulta se uma credencial passaria num portão, sem abrir nada nem gravar
 * passagem. O resultado (dado pessoal) fica só no estado deste componente.
 */
export default function VerifyAccessCard({ gates }: { gates: Gate[] }) {
  const [gateNumber, setGateNumber] = useState<number | "">(gates[0]?.numeroDispositivo ?? "");
  const [credential, setCredential] = useState("");
  const gate = gates.find((item) => item.numeroDispositivo === gateNumber) ?? null;

  const verify = useMutation({
    mutationFn: ({ id, target }: { id: string; target: Gate }) =>
      verifyAccess({ id, numeroDispositivo: target.numeroDispositivo, sentido: gateSentido(target) }),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const id = credential.trim();
    if (gate && id) verify.mutate({ id, target: gate });
  };

  const notFound = verify.error instanceof ApiError && verify.error.type === "not-found";

  return (
    <SectionCard title="Conferir acesso" subtitle="Consulta se a credencial passaria no portão. Não abre nem registra nada.">
      <Stack component="form" spacing={2} onSubmit={submit} noValidate>
        <TextField
          select
          label="Portão"
          value={gateNumber}
          onChange={(event) => {
            setGateNumber(Number(event.target.value));
            verify.reset();
          }}
        >
          {gates.map((item) => (
            <MenuItem key={item.numeroDispositivo} value={item.numeroDispositivo}>
              {item.nome}
            </MenuItem>
          ))}
        </TextField>
        <Stack direction="row" spacing={1}>
          <TextField
            label="CPF, placa, TAG ou ID"
            value={credential}
            onChange={(event) => {
              setCredential(event.target.value);
              verify.reset();
            }}
            slotProps={{ htmlInput: { autoComplete: "off" } }}
            sx={{ flexGrow: 1 }}
          />
          <Button type="submit" variant="outlined" loading={verify.isPending} disabled={!gate || !credential.trim()}>
            Conferir
          </Button>
        </Stack>

        {notFound && <Alert severity="warning">Nenhum cadastro encontrado para esta credencial.</Alert>}
        {verify.isError && !notFound && <Alert severity="error">{errorMessage(verify.error)}</Alert>}
        {verify.isSuccess && verify.data.length === 0 && (
          <Alert severity="warning">Nenhum cadastro encontrado para esta credencial.</Alert>
        )}
        {verify.isSuccess &&
          verify.data.map((row, index) => {
            const allowed = isAccessAllowed(row);
            return (
              <Box key={index} sx={{ p: 1.5, borderRadius: 1, bgcolor: "action.hover" }}>
                <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                  <div>
                    <Typography sx={{ fontWeight: 600 }}>{row.NOME || "Sem nome no cadastro"}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {[unitLabel(row.QUADRA, row.LOTE), row.DESCRICAO, row.DESCMIDIA].filter((part) => part && part !== "—").join(" · ")}
                    </Typography>
                  </div>
                  <StatusChip label={allowed ? "Autorizado" : "Não autorizado"} tone={allowed ? "success" : "error"} />
                </Stack>
              </Box>
            );
          })}
      </Stack>
    </SectionCard>
  );
}
