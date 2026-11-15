import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "@/app/router";
import NotifyProvider from "@/core/ui/components/NotifyProvider";
import AppThemeProvider from "@/core/ui/theme/AppThemeProvider";

/** Monta o painel inteiro (rotas e provedores reais) no endereço informado. */
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  // Cliente novo por teste: cache não vaza de um teste para o outro.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  render(
    <AppThemeProvider>
      <QueryClientProvider client={queryClient}>
        <NotifyProvider>
          <RouterProvider router={router} />
        </NotifyProvider>
      </QueryClientProvider>
    </AppThemeProvider>,
  );

  return router;
}
