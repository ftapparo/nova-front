import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router";
import Button from "@mui/material/Button";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import { errorMessage } from "@/core/api/http";
import EmptyState from "@/core/ui/components/EmptyState";
import ErrorState from "@/core/ui/components/ErrorState";
import SectionCard from "@/core/ui/components/SectionCard";

export interface ActivityItem {
  key: string;
  primary: string;
  secondary: string;
  end?: ReactNode;
}

interface ActivityCardProps {
  title: string;
  items: ActivityItem[];
  pending: boolean;
  error: unknown;
  onRetry: () => void;
  emptyTitle: string;
  moreTo: string;
}

/** Lista curta com o mais recente de um assunto e o caminho para ver tudo. */
export default function ActivityCard({ title, items, pending, error, onRetry, emptyTitle, moreTo }: ActivityCardProps) {
  return (
    <SectionCard
      title={title}
      action={
        <Button component={RouterLink} to={moreTo} size="small">
          Ver tudo
        </Button>
      }
    >
      {pending && <LinearProgress aria-label={`Carregando ${title}`} />}
      {!pending && error ? <ErrorState description={errorMessage(error)} onRetry={onRetry} /> : null}
      {!pending && !error && items.length === 0 && <EmptyState title={emptyTitle} />}
      {items.length > 0 && (
        <List dense disablePadding aria-label={title}>
          {items.map((item) => (
            <ListItem key={item.key} divider disableGutters secondaryAction={item.end}>
              <ListItemText primary={item.primary} secondary={item.secondary} sx={{ pr: item.end ? 14 : 0 }} />
            </ListItem>
          ))}
        </List>
      )}
    </SectionCard>
  );
}
