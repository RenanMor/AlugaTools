import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Appearance, View, useColorScheme as useSystemColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme, vars } from "nativewind";

import { SchemeColors, type ColorScheme } from "@/constants/theme";

type ThemeContextValue = {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  primaryColor: string | null;
  setPrimaryColor: (color: string | null) => void;
  secondaryColor: string | null;
  setSecondaryColor: (color: string | null) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("dark");
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  const [secondaryColor, setSecondaryColor] = useState<string | null>(null);

  const applyScheme = useCallback((scheme: ColorScheme) => {
    nativewindColorScheme.set(scheme);
    Appearance.setColorScheme?.(scheme);
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.dataset.theme = scheme;
      root.classList.toggle("dark", scheme === "dark");
      const palette = SchemeColors[scheme];
      Object.entries(palette).forEach(([token, value]) => {
        root.style.setProperty(`--color-${token}`, value);
      });
      if (primaryColor) {
        root.style.setProperty("--color-primary", primaryColor);
      }
      if (secondaryColor) {
        root.style.setProperty("--color-secondary", secondaryColor);
      }
    }
  }, [primaryColor, secondaryColor]);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    applyScheme(scheme);
  }, [applyScheme]);

  useEffect(() => {
    applyScheme(colorScheme);
  }, [applyScheme, colorScheme]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (primaryColor) {
        root.style.setProperty("--color-primary", primaryColor);
      } else {
        root.style.setProperty("--color-primary", SchemeColors[colorScheme].primary);
      }
      if (secondaryColor) {
        root.style.setProperty("--color-secondary", secondaryColor);
      } else {
        root.style.setProperty("--color-secondary", (SchemeColors[colorScheme] as any).secondary || SchemeColors[colorScheme].primary);
      }
    }
  }, [primaryColor, secondaryColor, colorScheme]);

  const themeVariables = useMemo(
    () =>
      vars({
        "color-primary": primaryColor || SchemeColors[colorScheme].primary,
        "color-background": SchemeColors[colorScheme].background,
        "color-surface": SchemeColors[colorScheme].surface,
        "color-foreground": SchemeColors[colorScheme].foreground,
        "color-muted": SchemeColors[colorScheme].muted,
        "color-border": SchemeColors[colorScheme].border,
        "color-success": SchemeColors[colorScheme].success,
        "color-warning": SchemeColors[colorScheme].warning,
        "color-error": SchemeColors[colorScheme].error,
        "color-secondary": secondaryColor || (SchemeColors[colorScheme] as any).secondary || SchemeColors[colorScheme].primary,
      }),
    [colorScheme, primaryColor, secondaryColor],
  );

  const value = useMemo(
    () => ({
      colorScheme,
      setColorScheme,
      primaryColor,
      setPrimaryColor,
      secondaryColor,
      setSecondaryColor,
    }),
    [colorScheme, setColorScheme, primaryColor, setPrimaryColor, secondaryColor, setSecondaryColor],
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={[{ flex: 1 }, themeVariables]}>{children}</View>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used within ThemeProvider");
  }
  return ctx;
}
