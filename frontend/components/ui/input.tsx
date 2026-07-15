import React, { useState } from "react";
import { TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { IconSymbol } from "./icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { radius, spacing, fontSize } from "@/lib/design-tokens";

interface InputProps extends Omit<TextInputProps, "style"> {
  icon?: string;
  containerStyle?: ViewStyle;
}

/**
 * Input — styled text input with optional left icon.
 * Shows primary-colored border on focus.
 */
export function Input({ icon, containerStyle, ...props }: InputProps) {
  const colors = useColors();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm + 2,
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg - 2,
          paddingVertical: spacing.md,
          borderWidth: 1,
          borderColor: focused ? colors.primary : colors.border,
        },
        containerStyle,
      ]}
    >
      {icon ? <IconSymbol name={icon as any} size={18} color={colors.muted} /> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        style={{
          flex: 1,
          color: colors.foreground,
          fontSize: fontSize.md,
          padding: 0,
        }}
      />
    </View>
  );
}
