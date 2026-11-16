import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { errorMessage } from "@/core/api/http";
import ConfirmDialog from "@/core/ui/components/ConfirmDialog";
import SectionCard from "@/core/ui/components/SectionCard";
import { configureExhaustModule, EXHAUST_MODULE_IDS, type ExhaustModuleId } from "@/features/exhaust/exhaustApi";

// Resposta do módulo sem formato fixo: mostrada como veio, com limite.
const RESULT_MAX_CHARS = 4000;
const showResult = (value: unknown) => {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return text.length > RESULT_MAX_CHARS ? `${text.slice(0, RESULT_MAX_CHARS)}…` : text;
};

/** Comando direto a um módulo Tasmota dos exaustores. Só admin, com confirmação. */
export default function ModuleConfigCard() {
  const [modulo, setModulo] = useState<ExhaustModuleId>(EXHAUST_MODULE_IDS[0]);
  const [comando, setComando] = useState("");
  const [confirming, setConfirming] = useState(false);

  const send = useMutation({
    mutationFn: () => configureExhaustModule(modulo, comando.trim()),
    onSettled: () => setConfirming(false),
  });

  return (
    <SectionCard
      title="Configuração de módulo de exaustor"
      subtitle="Comando direto ao módulo (Tasmota). Use só com orientação técnica: pode desligar relés ou mudar o comportamento do módulo."
    >
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <TextField select label="Módulo" value={modulo} onChange={(event) => setModulo(event.target.value as ExhaustModuleId)} sx={{ minWidth: 140 }}>
            {EXHAUST_MODULE_IDS.map((id) => (
              <MenuItem key={id} value={id}>
                {id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Comando"
            value={comando}
            onChange={(event) => {
              setComando(event.target.value);
              send.reset();
            }}
            helperText="Backlog do Tasmota já codificado para URL, como no painel anterior."
            slotProps={{ htmlInput: { maxLength: 1000, spellCheck: false } }}
            sx={{ flexGrow: 1 }}
          />
        </Stack>
        <Box>
          <Button variant="outlined" color="warning" disabled={!comando.trim()} onClick={() => setConfirming(true)}>
            Enviar ao módulo
          </Button>
        </Box>
        {send.isError && <Alert severity="error">{errorMessage(send.error)}</Alert>}
        {send.isSuccess && (
          <Box
            component="pre"
            aria-label="Resposta do módulo"
            sx={{ m: 0, p: 1.5, borderRadius: 1, bgcolor: "action.hover", overflow: "auto", maxHeight: 280, fontSize: "0.8125rem" }}
          >
            {showResult(send.data)}
          </Box>
        )}
      </Stack>
      <ConfirmDialog
        open={confirming}
        tone="danger"
        title={`Enviar comando ao módulo ${modulo}?`}
        description={`O módulo executa "${comando.trim()}" na hora. Não há como desfazer pelo painel.`}
        confirmLabel="Enviar"
        loading={send.isPending}
        onConfirm={() => send.mutate()}
        onClose={() => setConfirming(false)}
      />
    </SectionCard>
  );
}
