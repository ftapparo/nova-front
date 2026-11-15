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
import CommandButton from "@/core/ui/components/CommandButton";
import ConfirmDialog from "@/core/ui/components/ConfirmDialog";
import StatusChip from "@/core/ui/components/StatusChip";
import { useCommand } from "@/core/ui/useCommand";
import {
  exhaustLabel,
  exhaustPhase,
  remainingLabel,
  setExhaustMaintenance,
  turnOffExhaust,
  turnOnExhaust,
  type Exhaust,
  type ExhaustPhase,
} from "../exhaustApi";
import { useApplyExhaust } from "../exhaustQueries";
import TurnOnDialog from "./TurnOnDialog";

const PHASE: Record<ExhaustPhase, { label: string; tone: "success" | "neutral" | "warning" | "error" }> = {
  on: { label: "Ligado", tone: "success" },
  off: { label: "Desligado", tone: "neutral" },
  "turning-on": { label: "Ligando…", tone: "warning" },
  "turning-off": { label: "Desligando…", tone: "warning" },
  error: { label: "Falha no último comando", tone: "error" },
};

type Dialog = "on" | "off" | "maintenance" | null;

interface ExhaustCardProps {
  exhaust: Exhaust;
  now: number;
  /** Síndico/admin: marcar e desmarcar manutenção. */
  canManage: boolean;
}

export default function ExhaustCard({ exhaust, now, canManage }: ExhaustCardProps) {
  const apply = useApplyExhaust();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const label = exhaustLabel(exhaust);
  const close = () => setDialog(null);

  const turnOn = useCommand({
    mutationFn: (minutes: number) => turnOnExhaust(exhaust.id, minutes),
    successMessage: () => (exhaust.on ? `${label}: tempo reiniciado.` : `${label}: ligando.`),
    onSuccess: (updated) => {
      apply(updated);
      close();
    },
  });
  const turnOff = useCommand({
    mutationFn: () => turnOffExhaust(exhaust.id),
    successMessage: () => `${label}: desligando.`,
    onSuccess: (updated) => {
      apply(updated);
      close();
    },
  });
  const maintenance = useCommand({
    mutationFn: (value: boolean) => setExhaustMaintenance(exhaust.id, value),
    successMessage: (_data, value) => (value ? `${label}: em manutenção.` : `${label}: liberado para uso.`),
    onSuccess: (updated) => {
      apply(updated);
      close();
    },
  });

  const phase = exhaustPhase(exhaust);
  const inProgress = phase === "turning-on" || phase === "turning-off";
  // Sem módulo, o comando não chega ao relé: nada a oferecer além de esperar.
  const offline = !exhaust.moduleOnline;

  return (
    <Card>
      <CardContent sx={{ pb: 1 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
          <div>
            <Typography variant="h3" component="h3">
              {exhaust.id}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              {label}
            </Typography>
          </div>
          {canManage && (
            <IconButton size="small" aria-label={`Mais ações de ${exhaust.id}`} onClick={(event) => setMenuAnchor(event.currentTarget)}>
              <MoreVert fontSize="small" />
            </IconButton>
          )}
        </Stack>

        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1, mt: 1.5 }}>
          <StatusChip label={PHASE[phase].label} tone={PHASE[phase].tone} />
          {offline && <StatusChip label="Módulo offline" tone="error" />}
          {exhaust.maintenance && <StatusChip label="Em manutenção" tone="warning" />}
        </Stack>
        {exhaust.on && exhaust.expiresAt !== null && (
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            {remainingLabel(exhaust.expiresAt, now)}
          </Typography>
        )}
        {exhaust.on && exhaust.expiresAt === null && (
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            Sem desligamento automático
          </Typography>
        )}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
        <CommandButton
          command={turnOn}
          variant={exhaust.on ? "outlined" : "contained"}
          size="small"
          disabled={offline || exhaust.maintenance || inProgress}
          onClick={() => setDialog("on")}
        >
          {exhaust.on ? "Reiniciar tempo" : "Ligar"}
        </CommandButton>
        {/* Desligar segue disponível com "Ligando…": um comando que não termina não pode prender o relé ligado. */}
        {(exhaust.on || phase === "turning-on") && (
          <CommandButton
            command={turnOff}
            variant="outlined"
            color="error"
            size="small"
            disabled={offline || phase === "turning-off"}
            onClick={() => setDialog("off")}
          >
            Desligar
          </CommandButton>
        )}
      </CardActions>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDialog("maintenance");
          }}
        >
          <ListItemText>{exhaust.maintenance ? "Liberar da manutenção" : "Marcar manutenção"}</ListItemText>
        </MenuItem>
      </Menu>

      {dialog === "on" && <TurnOnDialog exhaust={exhaust} command={turnOn} onClose={close} />}
      <ConfirmDialog
        open={dialog === "off"}
        tone="danger"
        title="Desligar exaustor"
        description={`Desligar o exaustor ${exhaust.id} (${label}) agora?`}
        confirmLabel="Desligar"
        loading={turnOff.pending}
        onConfirm={() => turnOff.run()}
        onClose={close}
      />
      <ConfirmDialog
        open={dialog === "maintenance"}
        title={exhaust.maintenance ? "Liberar da manutenção" : "Marcar manutenção"}
        description={
          exhaust.maintenance
            ? `O exaustor ${exhaust.id} volta a poder ser ligado pela equipe e pelos moradores.`
            : `Enquanto estiver em manutenção, ninguém consegue ligar o exaustor ${exhaust.id}. Se estiver ligado, continua ligado: desligue antes, se for o caso.`
        }
        confirmLabel={exhaust.maintenance ? "Liberar" : "Marcar manutenção"}
        loading={maintenance.pending}
        onConfirm={() => maintenance.run(!exhaust.maintenance)}
        onClose={close}
      />
    </Card>
  );
}
