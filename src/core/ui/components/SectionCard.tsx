import type { ReactNode } from "react";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";

interface SectionCardProps {
  title: string;
  subtitle?: string;
  /** Ação do cabeçalho (botão, menu, chip de status). */
  action?: ReactNode;
  children: ReactNode;
}

export default function SectionCard({ title, subtitle, action, children }: SectionCardProps) {
  return (
    <Card component="section">
      <CardHeader
        title={title}
        subheader={subtitle}
        action={action}
        slotProps={{
          title: { variant: "h2", component: "h2" },
          subheader: { variant: "subtitle2", color: "textSecondary" },
        }}
      />
      <CardContent sx={{ pt: 0 }}>{children}</CardContent>
    </Card>
  );
}
