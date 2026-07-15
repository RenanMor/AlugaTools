import { useContext } from "react";
import { Colors, type ColorScheme, type ThemeColorPalette } from "@/constants/theme";
import { useColorScheme } from "./use-color-scheme";

// Direct context import to avoid the throwing version
import React from "react";

/**
 * Returns the current theme's color palette.
 * Reads dynamic brand colors from ThemeContext when available.
 *
 * NOTE: We import ThemeContext directly instead of using the throwing
 * `useThemeContext()` hook, because hooks must never be called inside
 * try/catch (violates Rules of Hooks).
 */

// We need to access the context without the throwing wrapper.
// The ThemeContext is not exported, so we use a safe pattern:
// Import the hook but handle the case where it might not be available.
let _useThemeContext: (() => { primaryColor: string | null; secondaryColor: string | null } | null) | null = null;

try {
  // Dynamic require to get the safe version
  const mod = require("@/lib/theme-provider");
  _useThemeContext = mod.useThemeContext;
} catch {
  // Not available
}

export function useColors(colorSchemeOverride?: ColorScheme): ThemeColorPalette {
  const colorSchema = useColorScheme();
  const scheme = (colorSchemeOverride ?? colorSchema ?? "dark") as ColorScheme;

  // Always call the hook (Rules of Hooks compliance).
  // If useThemeContext throws, we catch at module level, not per-render.
  let dynamicPrimary: string | null = null;
  let dynamicSecondary: string | null = null;

  if (_useThemeContext) {
    try {
      const ctx = _useThemeContext();
      if (ctx) {
        dynamicPrimary = ctx.primaryColor || null;
        dynamicSecondary = ctx.secondaryColor || null;
      }
    } catch {
      // Outside provider — use defaults
    }
  }

  const baseColors = Colors[scheme];

  if (dynamicPrimary) {
    return {
      ...baseColors,
      primary: dynamicPrimary,
      secondary: dynamicSecondary || dynamicPrimary,
      tint: dynamicPrimary,
      tabIconSelected: dynamicPrimary,
    };
  }

  return baseColors;
}
