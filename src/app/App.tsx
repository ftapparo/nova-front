import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/core/api/queryClient";
import NotifyProvider from "@/core/ui/components/NotifyProvider";
import AppThemeProvider from "@/core/ui/theme/AppThemeProvider";
import { createAppRouter } from "./router";

const router = createAppRouter();

export default function App() {
  return (
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <NotifyProvider>
          <RouterProvider router={router} />
        </NotifyProvider>
      </QueryClientProvider>
    </AppThemeProvider>
  );
}
