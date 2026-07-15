import { ThemeColorPalette } from "@/constants/theme";

// ─── Spacing ───────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// ─── Border Radius ─────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 9999,
} as const;

// ─── Font Size ─────────────────────────────────────────────
export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  hero: 28,
} as const;

// ─── Font Weight (React Native compatible string values) ───
export const fontWeight = {
  normal: "400" as const,
  medium: "500" as const,
  semibold: "600" as const,
  bold: "700" as const,
  black: "800" as const,
};

// ─── Shadow Presets ────────────────────────────────────────
export const shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

// ─── Composite Style Factories ─────────────────────────────

/** Standard card style with glassmorphism-lite effect */
export const cardStyle = (colors: ThemeColorPalette) => ({
  padding: spacing.md,
  borderRadius: radius.lg,
  backgroundColor: colors.surface,
  borderWidth: 0.5,
  borderColor: colors.border,
  ...shadow.sm,
});

/** Input field style */
export const inputStyle = (colors: ThemeColorPalette) => ({
  backgroundColor: colors.surface,
  borderRadius: radius.md,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.md,
  borderWidth: 1,
  borderColor: colors.border,
  color: colors.foreground,
  fontSize: fontSize.md,
});

/** Row-style list item */
export const rowStyle = (colors: ThemeColorPalette) => ({
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: spacing.md,
  padding: spacing.lg,
  borderRadius: radius.lg,
  backgroundColor: colors.surface,
  borderWidth: 0.5,
  borderColor: colors.border,
});

/** Section header text style */
export const sectionTitle = (colors: ThemeColorPalette) => ({
  fontSize: fontSize.xl,
  fontWeight: fontWeight.black,
  color: colors.foreground,
});

/** Page title text style */
export const pageTitle = (colors: ThemeColorPalette) => ({
  fontSize: fontSize.xxl,
  fontWeight: fontWeight.black,
  color: colors.foreground,
});
