import { Link as RouterLink } from "react-router";
import Button from "@mui/material/Button";
import CommandButton from "@/core/ui/components/CommandButton";
import { useCommand } from "@/core/ui/useCommand";
import { openDoor } from "@/features/gates/gatesApi";
import type { Shortcut } from "../shortcuts";

interface ShortcutButtonProps {
  shortcut: Shortcut;
  /** Nome do equipamento, para atalho sem nome próprio; null = não existe mais. */
  equipmentName: string | null;
}

/**
 * Porta abre direto. Portão leva à tela de Portões e Portas com ele já
 * escolhido: a abertura continua exigindo a conferência do CPF.
 */
export default function ShortcutButton({ shortcut, equipmentName }: ShortcutButtonProps) {
  const label = shortcut.label.trim() || equipmentName || "Equipamento removido";
  const open = useCommand({
    mutationFn: () => openDoor(shortcut.target),
    successMessage: () => `${label}: aberta.`,
  });

  const sx = { justifyContent: "flex-start", py: 1.5, textAlign: "left" } as const;

  if (shortcut.kind === "gate") {
    return (
      <Button variant="outlined" size="large" component={RouterLink} to={`/portoes-portas?portao=${shortcut.target}`} disabled={!equipmentName} sx={sx}>
        Abrir {label}
      </Button>
    );
  }
  return (
    <CommandButton command={open} variant="outlined" size="large" disabled={!equipmentName} onClick={() => open.run()} sx={sx}>
      Abrir {label}
    </CommandButton>
  );
}
