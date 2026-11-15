import { useState } from "react";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import LockResetOutlined from "@mui/icons-material/LockResetOutlined";
import ManageAccountsOutlined from "@mui/icons-material/ManageAccountsOutlined";
import MoreVert from "@mui/icons-material/MoreVert";

export type AccountAction = "reset-password" | "change-role" | "delete";

const ACTIONS = [
  { action: "reset-password", label: "Resetar senha", Icon: LockResetOutlined },
  { action: "change-role", label: "Trocar perfil", Icon: ManageAccountsOutlined },
  { action: "delete", label: "Excluir conta", Icon: DeleteOutlined },
] as const;

interface AccountActionsMenuProps {
  email: string | null;
  onAction: (action: AccountAction) => void;
}

export default function AccountActionsMenu({ email, onAction }: AccountActionsMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <IconButton
        size="small"
        aria-label={`Ações da conta ${email ?? ""}`}
        aria-haspopup="menu"
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <MoreVert fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {ACTIONS.map(({ action, label, Icon }) => (
          <MenuItem
            key={action}
            onClick={() => {
              setAnchor(null);
              onAction(action);
            }}
          >
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
