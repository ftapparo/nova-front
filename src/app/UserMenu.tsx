import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AccountCircleOutlined from "@mui/icons-material/AccountCircleOutlined";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import { STAFF_ROLE_LABEL, staffRoleOf } from "@/core/session/roles";
import { signOut } from "@/core/session/sessionActions";
import { useSession } from "@/core/session/useSession";

export default function UserMenu() {
  const session = useSession();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const logout = useMutation({ mutationFn: signOut });

  if (!session) return null;
  const role = staffRoleOf(session.user);

  return (
    <>
      <Tooltip title="Conta">
        <IconButton aria-label="Conta" aria-haspopup="menu" onClick={(event) => setAnchor(event.currentTarget)}>
          <AccountCircleOutlined />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <Box sx={{ px: 2, py: 1, maxWidth: 280 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {session.user.email}
          </Typography>
          {role && (
            <Typography variant="caption" color="textSecondary">
              {STAFF_ROLE_LABEL[role]}
            </Typography>
          )}
        </Box>
        <Divider />
        <MenuItem disabled={logout.isPending} onClick={() => logout.mutate()}>
          <ListItemIcon>
            <LogoutOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText>Sair</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
