import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import AppBar from "./AppBar";

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <AppBar>
            <SidebarTrigger className="-ml-1 text-primary hover:bg-primary/10 hover:text-primary active:bg-primary/15" />
          </AppBar>
          <main className="min-w-0 flex-1 py-6">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
