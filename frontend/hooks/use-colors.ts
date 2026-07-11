import { Colors, type ColorScheme, type ThemeColorPalette } from "@/constants/theme";
import { useColorScheme } from "./use-color-scheme";
import { useThemeContext } from "@/lib/theme-provider";

/**
 * Returns the current theme's color palette.
 * Usage: const colors = useColors(); then colors.text, colors.background, etc.
 */
export function useColors(colorSchemeOverride?: ColorScheme): ThemeColorPalette {
  const colorSchema = useColorScheme();
  const scheme = (colorSchemeOverride ?? colorSchema ?? "light") as ColorScheme;
  
  let dynamicPrimary: string | null = null;
  let dynamicSecondary: string | null = null;
  try {
    const themeContext = useThemeContext();
    if (themeContext) {
      if (themeContext.primaryColor) dynamicPrimary = themeContext.primaryColor;
      if (themeContext.secondaryColor) dynamicSecondary = themeContext.secondaryColor;
    }
  } catch (err) {
    // Fail silently if used outside provider
  }

  const baseColors = Colors[scheme];
  if (dynamicPrimary) {
    return {
      ...baseColors,
      primary: dynamicPrimary,
      secondary: dynamicSecondary || baseColors.secondary || dynamicPrimary,
      tint: dynamicPrimary,
      tabIconSelected: dynamicPrimary,
    };
  }

  return baseColors;
}
