import React, { useEffect, useRef } from "react";
import { Animated, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { radius } from "@/lib/design-tokens";

interface SkeletonProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Skeleton — shimmer loading placeholder.
 * Animates opacity between 0.3 and 0.7 for a subtle pulse effect.
 */
export function Skeleton({ width, height, borderRadius = radius.md, style }: SkeletonProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

/** Pre-built skeleton for a company card */
export function CompanyCardSkeleton() {
  return (
    <View style={{ flexDirection: "row", gap: 14, padding: 12 }}>
      <Skeleton width={68} height={68} borderRadius={radius.lg} />
      <View style={{ flex: 1, gap: 8, justifyContent: "center" }}>
        <Skeleton width="70%" height={16} />
        <Skeleton width="50%" height={12} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );
}

/** Pre-built skeleton for a tool grid card */
export function ToolCardSkeleton() {
  return (
    <View style={{ flex: 1, maxWidth: "48%", borderRadius: radius.lg, overflow: "hidden" }}>
      <Skeleton width="100%" height={110} borderRadius={0} />
      <View style={{ padding: 10, gap: 6 }}>
        <Skeleton width="80%" height={14} />
        <Skeleton width="50%" height={12} />
      </View>
    </View>
  );
}
