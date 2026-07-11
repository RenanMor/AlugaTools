import { View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient as SvgGradient, Rect, Stop } from "react-native-svg";
import { cn } from "@/lib/utils";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";

export interface ScreenContainerProps extends ViewProps {
  /**
   * SafeArea edges to apply. Defaults to ["top", "left", "right"].
   * Bottom is typically handled by Tab Bar.
   */
  edges?: Edge[];
  /**
   * Tailwind className for the content area.
   */
  className?: string;
  /**
   * Additional className for the outer container (background layer).
   */
  containerClassName?: string;
  /**
   * Additional className for the SafeAreaView (content layer).
   */
  safeAreaClassName?: string;
}

/**
 * A container component that properly handles SafeArea and background colors.
 *
 * The outer View extends to full screen (including status bar area) with the background color,
 * while the inner SafeAreaView ensures content is within safe bounds.
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  style,
  ...props
}: ScreenContainerProps) {
  const colors = useColors();
  let primaryColor: string | null = null;
  try {
    const themeContext = useThemeContext();
    primaryColor = themeContext?.primaryColor;
  } catch (err) {
    // Silent fallback
  }

  return (
    <View
      className={cn(
        "flex-1",
        "bg-background",
        containerClassName
      )}
      style={{ position: "relative" }}
      {...props}
    >
      {primaryColor ? (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: -2 }}>
          <Svg height="100%" width="100%">
            <Defs>
              <SvgGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={colors.background} stopOpacity="1" />
                <Stop offset="100%" stopColor={primaryColor} stopOpacity="0.18" />
              </SvgGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#bgGrad)" />
          </Svg>
        </View>
      ) : null}
      <SafeAreaView
        edges={edges}
        className={cn("flex-1", safeAreaClassName)}
        style={style}
      >
        <View className={cn("flex-1", className)}>{children}</View>
      </SafeAreaView>
    </View>
  );
}
