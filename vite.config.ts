import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as {
  version: string;
};

const SHORTCUT_ICON = { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" };

export default defineConfig(({ mode }) => {
  // Prefixo "" para ler V3_PROXY_TARGET, que não tem VITE_ de propósito:
  // é configuração do servidor de desenvolvimento, não entra no bundle.
  const env = loadEnv(mode, process.cwd(), "");
  const proxyTarget = env.V3_PROXY_TARGET?.trim();

  return {
    define: {
      "import.meta.env.APP_VERSION": JSON.stringify(version),
      "import.meta.env.BUILD_VERSION": JSON.stringify(process.env.BUILD_VERSION || "dev"),
    },
    plugins: [
      react(),
      // Service worker próprio (src/sw/sw.ts): precache do build e Web Push.
      // O manifesto torna o painel instalável (atalho na área de trabalho da portaria).
      VitePWA({
        strategies: "injectManifest",
        srcDir: "src/sw",
        filename: "sw.ts",
        registerType: "autoUpdate",
        injectRegister: "auto",
        // O Cloudflare Access protege o painel: sem o cookie dele, o pedido do
        // manifesto seria redirecionado para o login e bloqueado.
        useCredentials: true,
        manifest: {
          id: "/",
          name: "Nova Residence - Portal Administrativo",
          short_name: "Nova Residence",
          description: "Portal Administrativo para Portaria e Zeladoria",
          lang: "pt-BR",
          start_url: "/",
          scope: "/",
          display: "standalone",
          theme_color: "#4b1e74",
          background_color: "#f5f6fc",
          icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
          // Atalhos com ícone (96x96 ou maior): sem ele, algumas ferramentas
          // que geram o app Android a partir do manifesto recusam o atalho.
          shortcuts: [
            { name: "Portões e Portas", url: "/portoes-portas", icons: [SHORTCUT_ICON] },
            { name: "Central de Incêndio", url: "/incendio", icons: [SHORTCUT_ICON] },
            { name: "Acessos", url: "/acessos", icons: [SHORTCUT_ICON] },
          ],
        },
        injectManifest: { globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"], globIgnores: ["background-nova-residence.png"] },
        // Em desenvolvimento o service worker também roda, para testar o push.
        devOptions: { enabled: true, type: "module" },
      }),
    ],
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      host: "::",
      port: 8081,
      // A v3 da nova-api não tem CORS: o navegador fala sempre com a própria
      // origem e o /v3 (REST e WebSocket) é repassado. Em produção quem faz
      // isso é o nginx do container.
      proxy: proxyTarget
        ? { "/v3": { target: proxyTarget, changeOrigin: true, ws: true } }
        : undefined,
    },
    test: {
      environment: "jsdom",
      globals: true,
      unstubGlobals: true,
      testTimeout: 20_000,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}"],
    },
  };
});
