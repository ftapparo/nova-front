import type { ReactNode } from "react";
import { NavLink } from "react-router";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import Tooltip from "@mui/material/Tooltip";
import BrandLogo from "../components/BrandLogo";
import type { NavGroup } from "./navTypes";

interface SidebarProps {
  navigation: NavGroup[];
  /** Só ícones, com o título em tooltip. */
  collapsed?: boolean;
  footer?: ReactNode;
  onNavigate?: () => void;
}

export default function Sidebar({ navigation, collapsed = false, footer, onNavigate }: SidebarProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box
        sx={{
          height: 64,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <BrandLogo size={collapsed ? 44 : 72} />
      </Box>

      <Box component="nav" aria-label="Menu principal" sx={{ flexGrow: 1, overflowY: "auto", overflowX: "hidden" }}>
        {navigation.map((group, index) => (
          <List
            key={group.label}
            dense
            aria-label={group.label}
            subheader={
              collapsed ? (
                index > 0 && <Divider sx={{ my: 1 }} />
              ) : (
                <ListSubheader
                  disableSticky
                  sx={{ bgcolor: "transparent", typography: "overline", color: "text.secondary", lineHeight: 2.5, mt: 1 }}
                >
                  {group.label}
                </ListSubheader>
              )
            }
            sx={{ px: 1 }}
          >
            {group.items.map((item) => (
              <Tooltip key={item.path} title={collapsed ? item.title : ""} placement="right">
                <ListItemButton
                  component={NavLink}
                  to={item.path}
                  end={item.path === "/"}
                  onClick={onNavigate}
                  aria-label={item.title}
                  sx={(theme) => ({
                    borderRadius: 1,
                    mb: 0.25,
                    minHeight: 36,
                    justifyContent: collapsed ? "center" : "flex-start",
                    color: "text.primary",
                    "&.active": {
                      bgcolor: theme.vars.palette.soft.brand.bg,
                      color: theme.vars.palette.soft.brand.fg,
                      "& .MuiListItemIcon-root": { color: "inherit" },
                      "& .MuiListItemText-primary": { fontWeight: 600 },
                    },
                  })}
                >
                  <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: "text.secondary" }}>
                    <item.icon fontSize="small" />
                  </ListItemIcon>
                  {!collapsed && <ListItemText primary={item.title} />}
                </ListItemButton>
              </Tooltip>
            ))}
          </List>
        ))}
      </Box>

      {footer && !collapsed && (
        <Box sx={{ flexShrink: 0, borderTop: 1, borderColor: "divider", px: 2, py: 1.5 }}>{footer}</Box>
      )}
    </Box>
  );
}
