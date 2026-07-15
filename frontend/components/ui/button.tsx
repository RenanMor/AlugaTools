import React from "react";
import { ActivityIndicator, Pressable, Text, View, ViewStyle, TextStyle } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { radius, fontSize, fontWeight, spacing, shadow } from "@/lib/design-tokens";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  children: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

const sizeStyles: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { paddingVertical: 8, paddingHorizontal: 14, fontSize: fontSize.sm },
  md: { paddingVertical: 13, paddingHorizontal: 20, fontSize: fontSize.md },
  lg: { paddingVertical: 16, paddingHorizontal: 24, fontSize: fontSize.lg },
};

export function Button({
  children,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon,
  style,
}: ButtonProps) {
  const colors = useColors();
  const sizeConfig = sizeStyles[size];

  const variantStyles: Record<ButtonVariant, { bg: string; text: string; border?: string }> = {
    primary: { bg: colors.primary, text: "#FFFFFF" },
    secondary: { bg: colors.surface, text: colors.foreground, border: colors.border },
    outline: { bg: "transparent", text: colors.foreground, border: colors.border },
    ghost: { bg: "transparent", text: colors.foreground },
    destructive: { bg: colors.error + "18", text: colors.error },
  };

  const v = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          backgroundColor: v.bg,
          borderRadius: radius.lg,
          paddingVertical: sizeConfig.paddingVertical,
          paddingHorizontal: sizeConfig.paddingHorizontal,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          opacity: isDisabled ? 0.5 : 1,
          transform: [{ scale: pressed && !isDisabled ? 0.97 : 1 }],
          ...shadow.sm,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : icon ? (
        icon
      ) : null}
      <Text
        style={{
          color: v.text,
          fontSize: sizeConfig.fontSize,
          fontWeight: fontWeight.bold,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}
