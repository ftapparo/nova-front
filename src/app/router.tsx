import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";
import ChangePasswordPage from "@/features/auth/ChangePasswordPage";
import LoginPage from "@/features/auth/LoginPage";
import RecoverPasswordPage from "@/features/auth/RecoverPasswordPage";
import AppLayout from "./AppLayout";
import NotFoundPage from "./NotFoundPage";
import PlaceholderPage from "./PlaceholderPage";
import { PublicOnly, RequireRole, RequireSession, RequireStaff } from "./RouteGuards";
import { navigation } from "./navigation";

// Telas prontas, por caminho do menu. lazy(): o código de cada feature só é
// baixado quando a tela é aberta. Entrada do menu sem tela aqui mostra o
// placeholder.
const pages: Record<string, LazyExoticComponent<ComponentType>> = {
  "/contas": lazy(() => import("@/features/accounts/AccountsPage")),
  "/portoes-portas": lazy(() => import("@/features/gates/GatesPage")),
};

const menuRoutes: RouteObject[] = navigation.flatMap((section) =>
  section.items.map((item) => {
    const Page = pages[item.path];
    const element = (
      <RequireRole roles={item.roles}>{Page ? <Page /> : <PlaceholderPage title={item.title} />}</RequireRole>
    );
    return item.path === "/" ? { index: true, element } : { path: item.path, element };
  }),
);

export const routes: RouteObject[] = [
  {
    element: <PublicOnly />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/recuperar-senha", element: <RecoverPasswordPage /> },
    ],
  },
  {
    element: <RequireSession />,
    children: [
      { path: "/trocar-senha", element: <ChangePasswordPage /> },
      {
        element: <RequireStaff />,
        children: [
          {
            path: "/",
            element: <AppLayout />,
            children: [...menuRoutes, { path: "*", element: <NotFoundPage /> }],
          },
        ],
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
