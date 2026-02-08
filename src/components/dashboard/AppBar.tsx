import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Building2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  return (
    <header className="gradient-header shadow-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-primary-foreground" />
          <div>
            <h1 className="text-base font-bold text-primary-foreground leading-tight">Nova Residence</h1>
            <p className="text-xs text-primary-foreground/70">Portal Administrativo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold text-primary-foreground">
            {user}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-primary-foreground/90 hover:text-primary-foreground hover:bg-primary-foreground/10"
          >
            <LogOut className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
