import type { ReactElement } from "react";
import Chip from "@mui/material/Chip";
import type { SoftTone } from "../theme/tokens";

interface StatusChipProps {
  label: string;
  /** "neutral" para estados sem leitura de bom/ruim (ex.: "Desconhecido"). */
  tone: Exclude<SoftTone, "brand"> | "neutral";
  icon?: ReactElement;
}

export default function StatusChip({ label, tone, icon }: StatusChipProps) {
  return (
    <Chip
      size="small"
      variant="outlined"
      label={label}
      icon={icon}
      sx={(theme) => {
        if (tone === "neutral") {
          return { fontWeight: 600, color: "text.secondary", borderColor: "divider" };
        }
        const soft = theme.vars.palette.soft[tone];
        return {
          fontWeight: 600,
          bgcolor: soft.bg,
          borderColor: soft.border,
          color: soft.fg,
          "& .MuiChip-icon": { color: "inherit" },
        };
      }}
    />
  );
}
