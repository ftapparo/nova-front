import { LayoutDashboard, DoorOpen, Fan, Server } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import BrandLogo from "@/components/BrandLogo";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const menuItems = [
  {
    title: "Painel Operacional",
    url: "/dashboard",
    icon: LayoutDashboard,
    description: "Status geral do sistema",
  },
  {
    title: "Equipamentos",
    url: "/dashboard/equipamentos",
    icon: Server,
    description: "Status detalhado",
  },
  {
    title: "Controle de Acesso",
    url: "/dashboard/acesso",
    icon: DoorOpen,
    description: "Portas e Portões",
  },
  {
    title: "Exaustores",
    url: "/dashboard/exaustores",
    icon: Fan,
    description: "Controle de exaustores",
  },
];

export default function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar
      collapsible="icon"
      className={
        isCollapsed
          ? "[&_[data-sidebar=sidebar]]:bg-primary [&_[data-sidebar=sidebar]]:text-primary-foreground [&_[data-sidebar=header]]:border-primary/35 [&_[data-sidebar=footer]]:border-primary/35"
          : undefined
      }
    >
      <SidebarHeader className="h-14 border-b border-sidebar-border p-0">
        <div className="flex h-full items-center gap-3 px-4">
          {!isCollapsed && <BrandLogo className="h-8 w-8" fallbackClassName="h-8 w-8" />}
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">Nova Residence</span>
              <span className="text-xs text-sidebar-foreground/60">Portaria</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className={`flex items-center gap-3 ${
                        isCollapsed
                          ? "text-primary-foreground/90 hover:bg-primary-dark/40 hover:text-primary-foreground"
                          : ""
                      }`}
                      activeClassName={
                        isCollapsed
                          ? "bg-primary-dark/50 text-primary-foreground font-medium"
                          : "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      }
                    >
                      <item.icon className={`h-4 w-4 ${isCollapsed ? "text-primary-foreground" : ""}`} />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!isCollapsed && (
          <div className="px-2 py-3">
            <p className="text-xs text-sidebar-foreground/50">Portal Administrativo v1.0</p>
            <p className="mt-1 text-[11px] text-sidebar-foreground/45">Desenvolvido por: Flavio Eduardo Tapparo</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
