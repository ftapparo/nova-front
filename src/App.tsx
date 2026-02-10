import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import Login from "./pages/Login";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import PainelOperacional from "./pages/dashboard/PainelOperacional";
import ControleAcesso from "./pages/dashboard/ControleAcesso";
import Exhausts from "./pages/dashboard/Exhausts";
import Equipamentos from "./pages/dashboard/Equipamentos";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardProvider>
                    <DashboardLayout />
                  </DashboardProvider>
                </ProtectedRoute>
              }
            >
              <Route index element={<PainelOperacional />} />
              <Route path="equipamentos" element={<Equipamentos />} />
              <Route path="acesso" element={<ControleAcesso />} />
              <Route path="exaustores" element={<Exhausts />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
