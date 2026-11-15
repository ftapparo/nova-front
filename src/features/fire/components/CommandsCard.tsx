import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CommandButton from "@/core/ui/components/CommandButton";
import ConfirmDialog from "@/core/ui/components/ConfirmDialog";
import SectionCard from "@/core/ui/components/SectionCard";
import { useCommand } from "@/core/ui/useCommand";
import { sendButtonCommand, type ButtonAction, type Panel } from "../fireApi";
import { fireKeys } from "../fireQueries";

const SUCCESS: Record<ButtonAction, string> = {
  "silence-bip": "Bip interno da central silenciado.",
  "silence-siren": "Sirenes silenciadas.",
  "release-siren": "Sirenes reativadas.",
  "alarm-general": "Alarme geral disparado.",
  restart: "Central reiniciando.",
};

/**
 * Os mesmos botões do painel anterior. Vários alternam estado na central:
 * nunca repetir sozinho (useCommand). Alarme geral e reinício pedem uma
 * segunda confirmação antes de enviar.
 */
export default function CommandsCard({ panel }: { panel: Panel }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<"alarm-general" | "restart" | null>(null);

  const command = useCommand({
    mutationFn: (action: ButtonAction) => sendButtonCommand(action),
    successMessage: (_data, action) => SUCCESS[action],
    onSuccess: () => {
      setConfirming(null);
      // A resposta traz o estado depois do comando; recarregar o painel pela
      // REST mantém a tela no formato interpretado pela API.
      void queryClient.invalidateQueries({ queryKey: fireKeys.all });
    },
  });

  const leds = panel.leds ?? {};
  const sirenSilenced = leds.sireneSilenciada === true;
  const unavailable = !panel.online || panel.restarting;

  return (
    <SectionCard
      title="Comandos"
      subtitle={unavailable ? "Indisponíveis: a central está sem comunicação ou reiniciando." : "Agem na central de verdade."}
    >
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" } }}>
        <CommandButton
          command={command}
          variant={leds.centralSilenciada ? "contained" : "outlined"}
          disabled={unavailable}
          onClick={() => command.run("silence-bip")}
        >
          Silenciar bip
        </CommandButton>
        <CommandButton
          command={command}
          variant={sirenSilenced ? "contained" : "outlined"}
          disabled={unavailable}
          onClick={() => command.run(sirenSilenced ? "release-siren" : "silence-siren")}
        >
          {sirenSilenced ? "Reativar sirenes" : "Silenciar sirenes"}
        </CommandButton>
        <CommandButton command={command} variant="contained" color="error" disabled={unavailable} onClick={() => setConfirming("alarm-general")}>
          Disparar alarme geral
        </CommandButton>
        <CommandButton command={command} variant="outlined" disabled={unavailable} onClick={() => setConfirming("restart")}>
          Reiniciar central
        </CommandButton>
      </Box>
      {leds.centralSilenciada && (
        <Typography variant="caption" color="textSecondary" component="p" sx={{ mt: 1.5 }}>
          Bip interno silenciado. A reativação é feita na própria central (ou depois de reiniciar).
        </Typography>
      )}

      <ConfirmDialog
        open={confirming === "alarm-general"}
        tone="danger"
        title="Disparar o alarme geral?"
        description="As sirenes do condomínio tocam. Use só em emergência real ou em simulado combinado."
        confirmLabel="Disparar alarme geral"
        loading={command.pending}
        onConfirm={() => command.run("alarm-general")}
        onClose={() => setConfirming(null)}
      />
      <ConfirmDialog
        open={confirming === "restart"}
        tone="danger"
        title="Reiniciar a central?"
        description="A central fica alguns instantes sem monitorar e volta sozinha. Eventos ativos são reavaliados depois do reinício."
        confirmLabel="Reiniciar central"
        loading={command.pending}
        onConfirm={() => command.run("restart")}
        onClose={() => setConfirming(null)}
      />
    </SectionCard>
  );
}
