import * as React from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps, useTheme } from "next-themes";

const FALLBACK_THEME_COLOR = {
  light: "#F5F6FA",
  dark: "#10131A",
} as const;

function resolveAppBackgroundColor(resolvedTheme: string | undefined) {
  const fallbackColor = resolvedTheme === "dark" ? FALLBACK_THEME_COLOR.dark : FALLBACK_THEME_COLOR.light;

  const isUsableColor = (value: string | null | undefined) => Boolean(value && value !== "transparent" && value !== "rgba(0, 0, 0, 0)");

  const bodyBackground = window.getComputedStyle(document.body).backgroundColor;
  if (isUsableColor(bodyBackground)) return bodyBackground;

  const htmlBackground = window.getComputedStyle(document.documentElement).backgroundColor;
  if (isUsableColor(htmlBackground)) return htmlBackground;

  return fallbackColor;
}

function ThemeMetaSync() {
  const { resolvedTheme } = useTheme();

  React.useEffect(() => {
    const applyThemeMeta = () => {
      const themeColor = resolveAppBackgroundColor(resolvedTheme);
      let themeMeta = document.querySelector("meta[name='theme-color']");

      if (!themeMeta) {
        themeMeta = document.createElement("meta");
        themeMeta.setAttribute("name", "theme-color");
        document.head.appendChild(themeMeta);
      }

      themeMeta.setAttribute("content", themeColor);
      document.documentElement.style.colorScheme = resolvedTheme === "dark" ? "dark" : "light";
    };

    const rafId = window.requestAnimationFrame(applyThemeMeta);
    return () => window.cancelAnimationFrame(rafId);
  }, [resolvedTheme]);

  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeMetaSync />
      {children}
    </NextThemesProvider>
  );
}
