import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { realtime } from "@/core/realtime/realtime";
import { endSession } from "@/core/session/sessionStore";

// Sessão e tempo real são singletons do módulo: sem isto, o login e o socket
// de um teste vazariam para o seguinte.
afterEach(() => {
  realtime.stop();
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
