import React from "react";
import { Text, View, ViewStyle } from "react-native";
import { IconSymbol } from "./icon-symbol";
import { Button } from "./button";
import { useColors } from "@/hooks/use-colors";
import { spacing, fontSize, fontWeight } from "@/lib/design-tokens";

interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

/**
 * EmptyState — reusable empty list placeholder.
 * Icon + title + optional description + optional action button.
 */
export function EmptyState({ icon, title, description, actionLabel, onAction, style }: EmptyStateProps) {
  const colors = useColors();

  return (
    <View style={[{ alignItems: "center", paddingTop: 80, paddingHorizontal: 30, gap: spacing.md }, style]}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 0.5,
          borderColor: colors.border,
          marginBottom: spacing.sm,
        }}
      >
        <IconSymbol name={icon as any} size={32} color={colors.muted} />
      </View>

      <Text style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.foreground, textAlign: "center" }}>
        {title}
      </Text>

      {description ? (
        <Text style={{ fontSize: fontSize.md, color: colors.muted, textAlign: "center", lineHeight: 20 }}>
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button onPress={onAction} size="md" style={{ marginTop: spacing.sm }}>
          {actionLabel}
        </Button>
      ) : null}
    </View>
  );
}
