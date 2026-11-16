import { useState } from "react";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import MoreVert from "@mui/icons-material/MoreVert";
import StatusChip from "@/core/ui/components/StatusChip";
import { CATEGORY, carouselLabel, type CondoMessage } from "../messagesApi";

const dateTimeFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const PREVIEW_CHARS = 240;

export type MessageAction = "pin" | "unpin" | "ttl" | "archive";

interface MessageCardProps {
  message: CondoMessage;
  /** Síndico/admin: fixar, mudar tempo no carrossel, arquivar. */
  canManage: boolean;
  onAction: (action: MessageAction) => void;
}

export default function MessageCard({ message, canManage, onAction }: MessageCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const category = CATEGORY[message.category];
  const long = message.body.length > PREVIEW_CHARS;
  const actions: [MessageAction, string][] = [
    message.pinned ? ["unpin", "Desafixar do carrossel"] : ["pin", "Fixar no carrossel"],
    ...(message.pinned ? [] : ([["ttl", "Tempo no carrossel"]] as [MessageAction, string][])),
    ["archive", "Arquivar"],
  ];

  return (
    <Card component="article" aria-label={message.title}>
      <CardContent sx={{ pb: 1 }}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center", rowGap: 1 }}>
            <StatusChip label={message.label || category.label} tone={category.tone} />
            {message.pinned && <StatusChip label="Fixado" tone="info" />}
          </Stack>
          {canManage && (
            <IconButton size="small" aria-label={`Ações do comunicado ${message.title}`} onClick={(event) => setAnchor(event.currentTarget)}>
              <MoreVert fontSize="small" />
            </IconButton>
          )}
        </Stack>
        <Typography variant="h3" component="h2" sx={{ mt: 1 }}>
          {message.title}
        </Typography>
        <Typography variant="caption" color="textSecondary" component="p">
          Publicado em {dateTimeFormat.format(new Date(message.publishedAt))}
          {message.expiresAt ? ` · válido até ${dateTimeFormat.format(new Date(message.expiresAt))}` : ""} · {carouselLabel(message)}
        </Typography>
        <Collapse in={expanded || !long} collapsedSize={72}>
          <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-line" }}>
            {message.body}
          </Typography>
        </Collapse>
      </CardContent>
      {long && (
        <CardActions sx={{ pt: 0 }}>
          <Button size="small" onClick={() => setExpanded((open) => !open)}>
            {expanded ? "Mostrar menos" : "Ler tudo"}
          </Button>
        </CardActions>
      )}

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {actions.map(([action, label]) => (
          <MenuItem
            key={action}
            onClick={() => {
              setAnchor(null);
              onAction(action);
            }}
          >
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Card>
  );
}
