import { useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import type { NavGroup } from "./navTypes";

const SIDEBAR_WIDTH = 264;
const SIDEBAR_COLLAPSED_WIDTH = 68;
const COLLAPSED_STORAGE_KEY = "nova-residence-v3-sidebar-collapsed";

// localStorage pode estar bloqueado (modo privado, política do navegador);
// a preferência do menu não justifica quebrar a tela por isso.
const readCollapsed = (): boolean => {
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

const storeCollapsed = (collapsed: boolean) => {
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(collapsed));
  } catch {
    // Sem persistência: vale só para esta sessão.
  }
};

interface AppShellProps {
  navigation: NavGroup[];
  topBarEnd?: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
}

export default function AppShell({ navigation, topBarEnd, sidebarFooter, children }: AppShellProps) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleMenuClick = () => {
    if (!isDesktop) {
      setMobileOpen((open) => !open);
      return;
    }
    const next = !collapsed;
    setCollapsed(next);
    storeCollapsed(next);
  };

  const desktopWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  const paperSx = { boxSizing: "border-box", bgcolor: "background.sidebar" } as const;

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: "background.default" }}>
      {isDesktop ? (
        <Drawer
          variant="permanent"
          sx={{ width: desktopWidth, flexShrink: 0 }}
          slotProps={{ paper: { sx: { ...paperSx, width: desktopWidth, overflowX: "hidden" } } }}
        >
          <Sidebar navigation={navigation} collapsed={collapsed} footer={sidebarFooter} />
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          slotProps={{ paper: { sx: { ...paperSx, width: SIDEBAR_WIDTH } } }}
        >
          <Sidebar navigation={navigation} footer={sidebarFooter} onNavigate={() => setMobileOpen(false)} />
        </Drawer>
      )}

      <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <TopBar onMenuClick={handleMenuClick} end={topBarEnd} />
        <Box component="main" sx={{ flexGrow: 1 }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
}
