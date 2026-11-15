import { useState } from "react";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import IconButton from "@mui/material/IconButton";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import MoreVert from "@mui/icons-material/MoreVert";
import { useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import CommandButton from "@/core/ui/components/CommandButton";
import ConfirmDialog from "@/core/ui/components/ConfirmDialog";
import StatusChip from "@/core/ui/components/StatusChip";
import { useCommand } from "@/core/ui/useCommand";
import { closeGate, gateSentido, keepGateOpen, restartGate, type GateState } from "../gatesApi";
import { gateKeys, type GateView } from "../gatesQueries";

const STATE_LABEL: Record<GateState["state"], { label: string; tone: "success" | "info" | "warning" | "neutral" }> = {
  closed: { label: "Fechado", tone: "success" },
  opening: { label: "Abrindo", tone: "warning" },
  open: { label: "Aberto", tone: "info" },
  closing: { label: "Fechando", tone: "warning" },
  unknown: { label: "Estado desconhecido", tone: "neutral" },
};

type ManagerAction = "keep-open" | "restart";

interface GateCardProps {
  gate: GateView;
  state: UseQueryResult<GateState> | undefined;
  antennaDown: boolean;
  /** Síndico/admin: manter aberto e reiniciar o serviço. */
  canManage: boolean;
}

export default function GateCard({ gate, state, antennaDown, canManage }: GateCardProps) {
  const queryClient = useQueryClient();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [confirming, setConfirming] = useState<ManagerAction | null>(null);
  const numero = gate.numeroDispositivo;

  // A resposta do comando já traz o estado do portão: atualiza a tela sem
  // esperar o evento do tempo real.
  const applyState = (result: { gate: GateState }) => queryClient.setQueryData(gateKeys.state(numero), result.gate);

  const close = useCommand({
    mutationFn: () => closeGate(numero),
    successMessage: () => `${gate.nome}: fechando.`,
    onSuccess: applyState,
  });
  const keepOpen = useCommand({
    mutationFn: () => keepGateOpen(numero),
    successMessage: () => `${gate.nome}: mantido aberto até ser fechado.`,
    onSuccess: (result) => {
      applyState(result);
      setConfirming(null);
    },
  });
  const restart = useCommand({
    mutationFn: () => restartGate(numero),
    successMessage: () => `${gate.nome}: serviço reiniciando. Volta sozinho em alguns segundos.`,
    onSuccess: () => setConfirming(null),
  });

  const current = state?.data;
  const stateInfo = current ? STATE_LABEL[current.state] : STATE_LABEL.unknown;

  return (
    <Card>
      <CardContent sx={{ pb: 1 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
          <div>
            <Typography variant="h3" component="h3">
              {gate.nome}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {gateSentido(gate) === "S" ? "Saída" : "Entrada"} · dispositivo {numero}
            </Typography>
          </div>
          {canManage && (
            <IconButton size="small" aria-label={`Mais ações de ${gate.nome}`} onClick={(event) => setMenuAnchor(event.currentTarget)}>
              <MoreVert fontSize="small" />
            </IconButton>
          )}
        </Stack>

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 1.5 }}>
          {gate.online === false ? (
            <StatusChip label="Sem comunicação" tone="error" />
          ) : (
            <StatusChip label={stateInfo.label} tone={stateInfo.tone} />
          )}
          {current?.keepOpen && <StatusChip label="Mantido aberto" tone="warning" />}
          {antennaDown && <StatusChip label="Antena desconectada" tone="error" />}
        </Stack>
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2 }}>
        <CommandButton command={close} variant="outlined" onClick={() => close.run()}>
          Fechar
        </CommandButton>
      </CardActions>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        {(
          [
            ["keep-open", "Manter aberto"],
            ["restart", "Reiniciar serviço do portão"],
          ] as const
        ).map(([action, label]) => (
          <MenuItem
            key={action}
            onClick={() => {
              setMenuAnchor(null);
              setConfirming(action);
            }}
          >
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      <ConfirmDialog
        open={confirming === "keep-open"}
        tone="danger"
        title="Manter o portão aberto"
        description={
          <>
            <strong>{gate.nome}</strong> abre e fica aberto, sem fechamento automático, até alguém usar "Fechar".
          </>
        }
        confirmLabel="Abrir e manter aberto"
        loading={keepOpen.pending}
        onConfirm={() => keepOpen.run()}
        onClose={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === "restart"}
        tone="danger"
        title="Reiniciar o serviço do portão"
        description={
          <>
            O serviço de <strong>{gate.nome}</strong> reinicia e volta sozinho em alguns segundos. Enquanto isso, a
            antena não lê TAGs.
          </>
        }
        confirmLabel="Reiniciar"
        loading={restart.pending}
        onConfirm={() => restart.run()}
        onClose={() => setConfirming(null)}
      />
    </Card>
  );
}
