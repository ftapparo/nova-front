import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import CommandButton from "@/core/ui/components/CommandButton";
import EmptyState from "@/core/ui/components/EmptyState";
import SectionCard from "@/core/ui/components/SectionCard";
import StatusChip from "@/core/ui/components/StatusChip";
import { useCommand } from "@/core/ui/useCommand";
import { openDoor } from "../gatesApi";
import type { DoorView } from "../gatesQueries";

function DoorRow({ door }: { door: DoorView }) {
  const open = useCommand({
    mutationFn: () => openDoor(door.id),
    successMessage: () => `${door.nome}: aberta.`,
  });

  return (
    <ListItem
      divider
      secondaryAction={
        <CommandButton command={open} variant="outlined" size="small" onClick={() => open.run()}>
          Abrir
        </CommandButton>
      }
      sx={{ pr: 14 }}
    >
      <ListItemText
        primary={door.nome}
        secondary={
          <Stack component="span" direction="row" sx={{ mt: 0.5 }}>
            {door.online === null ? (
              <StatusChip label="Sem leitura" tone="neutral" />
            ) : (
              <StatusChip label={door.online ? "Online" : "Sem comunicação"} tone={door.online ? "success" : "error"} />
            )}
          </Stack>
        }
        slotProps={{ secondary: { component: "span" } }}
      />
    </ListItem>
  );
}

export default function DoorsCard({ doors }: { doors: DoorView[] }) {
  return (
    <SectionCard title="Portas de pedestre">
      {doors.length === 0 ? (
        <EmptyState title="Nenhuma porta ativa" />
      ) : (
        <List disablePadding aria-label="Portas de pedestre">
          {doors.map((door) => (
            <DoorRow key={door.id} door={door} />
          ))}
        </List>
      )}
    </SectionCard>
  );
}
