// Identidade visual do Nova Residence. Os valores vêm dos tokens oklch do
// painel anterior (FRONT/src/theme/theme.css), convertidos para hex porque o
// MUI calcula hover/contraste a partir de cores em hex/rgb.

export type SoftTone = "success" | "error" | "warning" | "info" | "brand";

export interface SoftColor {
  bg: string;
  border: string;
  fg: string;
}

export interface SchemeTokens {
  primary: { main: string; dark: string; light: string };
  secondary: string;
  /** Dourado do logo: só para pequenos destaques, nunca como cor principal. */
  highlight: { main: string; contrastText: string };
  background: { default: string; paper: string; sidebar: string };
  text: { primary: string; secondary: string };
  divider: string;
  error: string;
  success: string;
  warning: { main: string; contrastText: string };
  info: string;
  soft: Record<SoftTone, SoftColor>;
}

export const lightTokens: SchemeTokens = {
  primary: { main: "#4b1e74", dark: "#39135a", light: "#7e5ba7" },
  secondary: "#543873",
  highlight: { main: "#e6ad00", contrastText: "#161107" },
  background: { default: "#f5f6fc", paper: "#ffffff", sidebar: "#ffffff" },
  text: { primary: "#262a34", secondary: "#6b707c" },
  divider: "#d6d9e1",
  error: "#e62d28",
  success: "#21b166",
  warning: { main: "#e5a300", contrastText: "#201a10" },
  info: "#2a75ba",
  soft: {
    success: { bg: "#d0f2d8", border: "#b1dabb", fg: "#026031" },
    error: { bg: "#ffdfdb", border: "#f9bdb8", fg: "#8c2d2d" },
    warning: { bg: "#ffe8be", border: "#e8cd9d", fg: "#6b4d01" },
    info: { bg: "#ddedff", border: "#bed4eb", fg: "#285077" },
    brand: { bg: "#ebe4f6", border: "#d5c6e9", fg: "#371a53" },
  },
};

export const darkTokens: SchemeTokens = {
  primary: { main: "#8d62bd", dark: "#744d9f", light: "#a181c9" },
  secondary: "#644983",
  highlight: { main: "#e0af3b", contrastText: "#15110a" },
  background: { default: "#14171e", paper: "#1b1e27", sidebar: "#1f232c" },
  text: { primary: "#f0f2f7", secondary: "#a7abb4" },
  divider: "#313540",
  error: "#cc2631",
  success: "#189f5a",
  warning: { main: "#cb9317", contrastText: "#15110a" },
  info: "#619dda",
  soft: {
    success: { bg: "#203d29", border: "#2c583a", fg: "#a3dab2" },
    error: { bg: "#502826", border: "#763d3a", fg: "#febab4" },
    warning: { bg: "#423315", border: "#634c1e", fg: "#ebcd95" },
    info: { bg: "#273442", border: "#384f68", fg: "#aecef1" },
    brand: { bg: "#372e42", border: "#544568", fg: "#eceef5" },
  },
};
