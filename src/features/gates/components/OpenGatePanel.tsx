import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { ApiError, errorMessage } from "@/core/api/http";
import { formatCpf, onlyDigits } from "@/core/format/documents";
import CommandButton from "@/core/ui/components/CommandButton";
import SectionCard from "@/core/ui/components/SectionCard";
import StatusChip from "@/core/ui/components/StatusChip";
import { useNotify } from "@/core/ui/components/useNotify";
import { useCommand } from "@/core/ui/useCommand";
import { isAccessAllowed, registerAccess, verifyAccess, type AccessVerifyRow } from "@/features/access/accessApi";
import { AUTO_CLOSE_MAX_SECONDS, AUTO_CLOSE_MIN_SECONDS, gateSentido, openGate } from "../gatesApi";
import { gateKeys, type GateView } from "../gatesQueries";

// Padrão da portaria (decisão de 16/11/2026); a API aceita de 1 a 120 s.
const DEFAULT_AUTO_CLOSE_SECONDS = 5;
// Forma de acesso gravada no ERP, a mesma que o painel anterior registrava.
const REGISTER_FORMA_ACESSO = "TAG";

type Verification = { row: AccessVerifyRow; allowed: boolean } | { notFound: true };

interface OpenGatePanelProps {
  gates: GateView[];
  /** Portão já escolhido (atalho do Painel Operacional). */
  initialGate?: number | null;
}

/**
 * Abertura de portão pela portaria: só depois de conferir o CPF no cadastro
 * do condomínio (regra do painel anterior), e a passagem é registrada no ERP
 * logo depois de abrir. O resultado da conferência fica só neste componente.
 */
export default function OpenGatePanel({ gates, initialGate = null }: OpenGatePanelProps) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number | "">(
    gates.find((gate) => gate.numeroDispositivo === initialGate)?.numeroDispositivo ?? gates[0]?.numeroDispositivo ?? "",
  );
  const [cpf, setCpf] = useState("");
  const [autoClose, setAutoClose] = useState(String(DEFAULT_AUTO_CLOSE_SECONDS));
  const [verification, setVerification] = useState<Verification | null>(null);

  const gate = gates.find((item) => item.numeroDispositivo === selected) ?? null;
  const autoCloseSeconds = Number(autoClose);
  const autoCloseValid =
    Number.isInteger(autoCloseSeconds) &&
    autoCloseSeconds >= AUTO_CLOSE_MIN_SECONDS &&
    autoCloseSeconds <= AUTO_CLOSE_MAX_SECONDS;

  const resetVerification = () => {
    setVerification(null);
    verify.reset();
  };

  const verify = useMutation({
    mutationFn: (target: GateView) =>
      verifyAccess({ id: cpf, numeroDispositivo: target.numeroDispositivo, sentido: gateSentido(target) }),
    onSuccess: (rows) => {
      const row = rows[0];
      setVerification(row ? { row, allowed: isAccessAllowed(row) } : { notFound: true });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.type === "not-found") setVerification({ notFound: true });
    },
  });

  const open = useCommand({
    mutationFn: async ({ target, row }: { target: GateView; row: AccessVerifyRow }) => {
      const result = await openGate(target.numeroDispositivo, autoCloseSeconds);
      queryClient.setQueryData(gateKeys.state(target.numeroDispositivo), result.gate);
      // O portão já abriu: falha no registro não pode virar "falha ao abrir".
      try {
        await registerAccess({
          row,
          numeroDispositivo: target.numeroDispositivo,
          sentido: gateSentido(target),
          formaAcesso: REGISTER_FORMA_ACESSO,
        });
      } catch (error) {
        notify.error(`Portão aberto, mas a passagem não foi registrada: ${errorMessage(error)}`);
        return { registered: false };
      }
      return { registered: true };
    },
    successMessage: ({ registered }, { target }) =>
      registered ? `${target.nome} aberto e passagem registrada.` : `${target.nome} aberto.`,
    onSuccess: () => {
      setCpf("");
      resetVerification();
    },
  });

  const submitVerify = (event: FormEvent) => {
    event.preventDefault();
    if (gate && cpf.length === 11) verify.mutate(gate);
  };

  const allowedRow = verification && "row" in verification && verification.allowed ? verification.row : null;

  return (
    <SectionCard title="Liberar passagem" subtitle="Confira o CPF no cadastro do condomínio antes de abrir o portão.">
      <Stack spacing={2}>
        <TextField
          select
          label="Portão"
          value={selected}
          onChange={(event) => {
            setSelected(Number(event.target.value));
            resetVerification();
          }}
        >
          {gates.map((item) => (
            <MenuItem key={item.numeroDispositivo} value={item.numeroDispositivo}>
              {item.nome}
            </MenuItem>
          ))}
        </TextField>

        <Stack component="form" direction="row" spacing={1} onSubmit={submitVerify} noValidate>
          <TextField
            label="CPF"
            value={formatCpf(cpf)}
            onChange={(event) => {
              setCpf(onlyDigits(event.target.value).slice(0, 11));
              resetVerification();
            }}
            slotProps={{ htmlInput: { inputMode: "numeric", autoComplete: "off" } }}
            sx={{ flexGrow: 1 }}
          />
          <Button type="submit" variant="outlined" loading={verify.isPending} disabled={!gate || cpf.length !== 11}>
            Conferir
          </Button>
        </Stack>

        {verify.isError && !(verify.error instanceof ApiError && verify.error.type === "not-found") && (
          <Alert severity="error">{errorMessage(verify.error)}</Alert>
        )}
        {verification && "notFound" in verification && (
          <Alert severity="warning">Nenhum cadastro encontrado para este CPF.</Alert>
        )}
        {verification && "row" in verification && (
          <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: "action.hover" }}>
            <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center", gap: 1 }}>
              <div>
                <Typography sx={{ fontWeight: 600 }}>{verification.row.NOME ?? "Sem nome no cadastro"}</Typography>
                <Typography variant="body2" color="textSecondary">
                  {[verification.row.QUADRA, verification.row.LOTE].filter(Boolean).join("-") || "Sem unidade"}
                  {verification.row.DESCRICAO ? ` · ${verification.row.DESCRICAO}` : ""}
                </Typography>
              </div>
              <StatusChip
                label={verification.allowed ? "Autorizado" : "Não autorizado"}
                tone={verification.allowed ? "success" : "error"}
              />
            </Stack>
          </Box>
        )}

        <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
          <TextField
            label="Fecha sozinho em (s)"
            type="number"
            value={autoClose}
            onChange={(event) => setAutoClose(event.target.value)}
            error={!autoCloseValid}
            helperText={autoCloseValid ? " " : `De ${AUTO_CLOSE_MIN_SECONDS} a ${AUTO_CLOSE_MAX_SECONDS} segundos.`}
            slotProps={{ htmlInput: { min: AUTO_CLOSE_MIN_SECONDS, max: AUTO_CLOSE_MAX_SECONDS } }}
            sx={{ width: 180 }}
          />
          <CommandButton
            command={open}
            variant="contained"
            size="large"
            disabled={!gate || !allowedRow || !autoCloseValid}
            onClick={() => gate && allowedRow && open.run({ target: gate, row: allowedRow })}
            sx={{ flexGrow: 1, mt: 0.5 }}
          >
            Abrir portão
          </CommandButton>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
