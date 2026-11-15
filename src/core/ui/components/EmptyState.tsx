import type { ReactNode } from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import InboxOutlined from "@mui/icons-material/InboxOutlined";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Ação sugerida (ex.: botão "Novo comunicado"). */
  action?: ReactNode;
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center", py: 6, px: 2, color: "text.secondary" }}>
      {icon ?? <InboxOutlined fontSize="large" />}
      <Typography variant="h3" component="p" color="textPrimary">
        {title}
      </Typography>
      {description && <Typography variant="body2">{description}</Typography>}
      {action}
    </Stack>
  );
}
