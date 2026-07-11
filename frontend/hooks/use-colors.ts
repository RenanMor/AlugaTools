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
  try {
    const themeContext = useThemeContext();
    if (themeContext && themeContext.primaryColor) {
      dynamicPrimary = themeContext.primaryColor;
    }
  } catch (err) {
    // Fail silently if used outside provider
  }

  const baseColors = Colors[scheme];
  if (dynamicPrimary) {
    return {
      ...baseColors,
      primary: dynamicPrimary,
      tint: dynamicPrimary,
      tabIconSelected: dynamicPrimary,
    };
  }

  return baseColors;
}
