import React from "react";
import { Pressable, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { radius, spacing, shadow } from "@/lib/design-tokens";

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  noPadding?: boolean;
}

/**
 * Card — glassmorphism-lite card component.
 * Subtle border, soft shadow, and 0.5px border for premium feel.
 * Optionally pressable with scale micro-animation.
 */
export function Card({ children, onPress, style, noPadding }: CardProps) {
  const colors = useColors();

  const cardStyles: ViewStyle = {
    padding: noPadding ? 0 : spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    ...shadow.sm,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyles,
          { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={[cardStyles, style]}>{children}</View>;
}
