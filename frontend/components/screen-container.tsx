import { View, Image, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient as SvgGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { cn } from "@/lib/utils";
import { useColors } from "@/hooks/use-colors";
import { useThemeContext } from "@/lib/theme-provider";
import { useApp } from "@/lib/app-context";

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
  /**
   * Optional custom watermark image URI.
   */
  watermarkUri?: string;
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
  watermarkUri,
  ...props
}: ScreenContainerProps) {
  const colors = useColors();
  const { user, companies } = useApp();
  let primaryColor: string | null = null;
  let secondaryColor: string | null = null;
  try {
    const themeContext = useThemeContext();
    primaryColor = themeContext?.primaryColor;
    secondaryColor = themeContext?.secondaryColor;
  } catch (err) {
    // Silent fallback
  }

  let watermarkSource: string | null = null;
  if (watermarkUri) {
    watermarkSource = watermarkUri;
  } else if (user) {
    if (user.profile === "company") {
      const myCompany = companies.find((c) => c.id === user.companyId);
      watermarkSource = user.avatarUrl || myCompany?.logo || null;
    } else if (user.profile === "deliverer") {
      const myCompany = companies.find((c) => c.id === user.delivererCompanyId);
      watermarkSource = myCompany?.logo || null;
    }
  }

  const baseColor = primaryColor || colors.primary || "#F97316";
  const compColor = secondaryColor || "#D946EF";
  const purpleColor = "#4C1D95";

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        position: "relative",
      }}
      {...props}
    >
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: -2 }}>
        <Svg height="100%" width="100%" style={{ width: "100%", height: "100%" }}>
          <Defs>
            <SvgGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#000000" stopOpacity="1" />
              <Stop offset="40%" stopColor="#000000" stopOpacity="1" />
              <Stop offset="72%" stopColor={purpleColor} stopOpacity="0.45" />
              <Stop offset="88%" stopColor={compColor} stopOpacity="0.55" />
              <Stop offset="100%" stopColor={baseColor} stopOpacity="0.65" />
            </SvgGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#bgGrad)" />
        </Svg>
      </View>
      {watermarkSource ? (
        <Image
          source={{ uri: watermarkSource }}
          style={{
            position: "absolute",
            alignSelf: "center",
            top: "30%",
            width: 320,
            height: 320,
            opacity: 0.40,
            resizeMode: "contain",
            zIndex: -1,
            pointerEvents: "none",
          }}
        />
      ) : null}
      <SafeAreaView
        edges={edges}
        style={[{ flex: 1 }, style]}
        className={safeAreaClassName}
      >
        <View style={{ flex: 1 }} className={className}>{children}</View>
      </SafeAreaView>
    </View>
  );
}
