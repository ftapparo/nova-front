import { createTheme, type PaletteColor, type PaletteColorOptions, type PaletteOptions } from "@mui/material/styles";
import { ptBR } from "@mui/material/locale";
import { darkTokens, lightTokens, type SchemeTokens, type SoftColor, type SoftTone } from "./tokens";

declare module "@mui/material/styles" {
  // Liga a tipagem de theme.vars (o tema é criado com cssVariables).
  interface CssThemeVariables {
    enabled: true;
  }
  interface Palette {
    highlight: PaletteColor;
    soft: Record<SoftTone, SoftColor>;
  }
  interface PaletteOptions {
    highlight?: PaletteColorOptions;
    soft?: Record<SoftTone, SoftColor>;
  }
  interface TypeBackground {
    sidebar: string;
  }
}

const FONT_SANS = '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const paletteFrom = (tokens: SchemeTokens): PaletteOptions => ({
  primary: { ...tokens.primary, contrastText: "#fafafa" },
  secondary: { main: tokens.secondary, contrastText: "#fafafa" },
  highlight: tokens.highlight,
  error: { main: tokens.error, contrastText: "#fafafa" },
  success: { main: tokens.success, contrastText: "#fafafa" },
  warning: tokens.warning,
  info: { main: tokens.info, contrastText: "#fafafa" },
  background: tokens.background,
  text: tokens.text,
  divider: tokens.divider,
  soft: tokens.soft,
});

export const theme = createTheme(
  {
    cssVariables: { colorSchemeSelector: "data" },
    colorSchemes: {
      light: { palette: paletteFrom(lightTokens) },
      dark: { palette: paletteFrom(darkTokens) },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: FONT_SANS,
      // h1 = título de página, h2 = título de seção, h3 = título de card,
      // h4 = valor de indicador. h5/h6 ficam como títulos menores.
      h1: { fontSize: "1.75rem", fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em" },
      h2: { fontSize: "1.125rem", fontWeight: 650, lineHeight: 1.3, letterSpacing: "-0.01em" },
      h3: { fontSize: "1rem", fontWeight: 650, lineHeight: 1.35, letterSpacing: "-0.01em" },
      h4: {
        fontSize: "2.5rem",
        fontWeight: 850,
        lineHeight: 1,
        letterSpacing: "-0.03em",
        fontVariantNumeric: "tabular-nums",
      },
      h5: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.35 },
      h6: { fontSize: "0.9375rem", fontWeight: 600, lineHeight: 1.35 },
      subtitle1: { fontSize: "1rem", fontWeight: 400, lineHeight: 1.55 },
      subtitle2: { fontSize: "0.875rem", fontWeight: 400, lineHeight: 1.45 },
      body1: { fontSize: "0.9375rem", lineHeight: 1.55 },
      body2: { fontSize: "0.875rem", lineHeight: 1.45 },
      caption: { fontSize: "0.8125rem", lineHeight: 1.4 },
      overline: { fontSize: "0.75rem", fontWeight: 550, lineHeight: 1.25, letterSpacing: "0.04em" },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
      },
      MuiCard: {
        defaultProps: { variant: "outlined" },
      },
      MuiPaper: {
        styleOverrides: {
          // No escuro o MUI clareia superfícies elevadas com um gradiente;
          // aqui a cor de cada superfície já vem definida nos tokens.
          root: { backgroundImage: "none" },
        },
      },
      MuiTooltip: {
        defaultProps: { arrow: true },
      },
    },
  },
  ptBR,
);
