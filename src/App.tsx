import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DashboardProvider } from "@/contexts/DashboardContext";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Login from "./pages/Login";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import PainelOperacional from "./pages/dashboard/PainelOperacional";
import ControleAcesso from "./pages/dashboard/ControleAcesso";
import Exhausts from "./pages/dashboard/Exaustores";
import Equipamentos from "./pages/dashboard/Equipamentos";
import Veiculos from "./pages/dashboard/Veiculos";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

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

function QueryCacheResetOnRouteChange() {
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const previousPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (previousPathRef.current && previousPathRef.current !== pathname) {
      const syncQueriesOnRouteChange = async () => {
        await queryClient.cancelQueries();
        queryClient.removeQueries({ type: "inactive" });
        await queryClient.refetchQueries({ type: "active" });
      };

      void syncQueriesOnRouteChange();
    }

    previousPathRef.current = pathname;
  }, [pathname, queryClient]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="nova-residence-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <QueryCacheResetOnRouteChange />
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
                <Route path="veiculos" element={<Veiculos />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
