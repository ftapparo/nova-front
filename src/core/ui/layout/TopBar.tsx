import type { ReactNode } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import MenuOutlined from "@mui/icons-material/MenuOutlined";

interface TopBarProps {
  onMenuClick: () => void;
  /** Conteúdo alinhado à direita (tema, usuário, sair). */
  end?: ReactNode;
}

export default function TopBar({ onMenuClick, end }: TopBarProps) {
  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      sx={{ bgcolor: "background.default", borderBottom: 1, borderColor: "divider" }}
    >
      <Toolbar sx={{ minHeight: { xs: 64 }, gap: 1 }}>
        <IconButton edge="start" aria-label="Abrir ou recolher o menu" onClick={onMenuClick}>
          <MenuOutlined />
        </IconButton>
        <Box sx={{ flexGrow: 1 }} />
        {end}
      </Toolbar>
    </AppBar>
  );
}
