import React from "react";
import { Text, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { radius, fontSize, fontWeight, spacing } from "@/lib/design-tokens";

type BadgeVariant = "success" | "warning" | "error" | "info" | "muted" | "primary";
type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  style?: ViewStyle;
}

/**
 * Badge — colored chip for status labels, categories, etc.
 * Uses translucent background with full-color text.
 */
export function Badge({ children, variant = "muted", size = "sm", style }: BadgeProps) {
  const colors = useColors();

  const colorMap: Record<BadgeVariant, string> = {
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: "#3B82F6",
    muted: colors.muted,
    primary: colors.primary,
  };

  const color = colorMap[variant];
  const isSmall = size === "sm";

  return (
    <View
      style={[
        {
          alignSelf: "flex-start",
          paddingHorizontal: isSmall ? spacing.sm + 2 : spacing.md,
          paddingVertical: isSmall ? 3 : 5,
          borderRadius: radius.pill,
          backgroundColor: color + "1A",
        },
        style,
      ]}
    >
      <Text
        style={{
          fontSize: isSmall ? fontSize.xs : fontSize.sm,
          fontWeight: fontWeight.bold,
          color: color,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
