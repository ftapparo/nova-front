import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { endSession } from "@/core/session/sessionStore";

// A sessão é um singleton do módulo: sem isto, o login de um teste vazaria
// para o seguinte.
afterEach(() => {
  endSession();
  window.localStorage.clear();
});

// O jsdom não implementa matchMedia, que o MUI usa em useMediaQuery e na
// detecção do tema do sistema. `matches: false` = tela estreita, tema claro.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
