/**
 * Web override: always force dark mode on web, regardless of OS color scheme.
 * The app's color palette is calibrated exclusively for dark backgrounds.
 */
export function useColorScheme() {
  return "dark" as const;
}
