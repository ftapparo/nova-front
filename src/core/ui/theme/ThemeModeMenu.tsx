import { useState, type MouseEvent } from "react";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import { useColorScheme } from "@mui/material/styles";
import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import SettingsBrightnessOutlined from "@mui/icons-material/SettingsBrightnessOutlined";

const MODES = [
  { value: "light", label: "Claro", Icon: LightModeOutlined },
  { value: "dark", label: "Escuro", Icon: DarkModeOutlined },
  { value: "system", label: "Sistema", Icon: SettingsBrightnessOutlined },
] as const;

export default function ThemeModeMenu() {
  const { mode, setMode } = useColorScheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const current = MODES.find((option) => option.value === mode) ?? MODES[2];

  return (
    <>
      <Tooltip title="Tema">
        <IconButton
          aria-label={`Tema: ${current.label}`}
          aria-haspopup="menu"
          onClick={(event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget)}
        >
          <current.Icon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {MODES.map(({ value, label, Icon }) => (
          <MenuItem
            key={value}
            selected={value === current.value}
            onClick={() => {
              setMode(value);
              setAnchor(null);
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
