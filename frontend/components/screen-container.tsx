import React, { useId, useMemo } from "react";
import { Image, View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { useThemeContext } from "@/lib/theme-provider";

type ScreenContainerProps = {
  children: React.ReactNode;
  edges?: Edge[];
  className?: string;
  containerClassName?: string;
  safeAreaClassName?: string;
  style?: any;
  watermarkUri?: string;
  [key: string]: any;
};

/**
 * ScreenContainer — unified layout wrapper for all screens.
 *
 * Renders a premium mesh-gradient background (3 radial layers over pure black),
 * an optional centered watermark, and wraps children in SafeAreaView.
 *
 * ─ Stability fixes applied ─
 * 1. No negative zIndex — draw order is controlled by JSX order
 * 2. Unique SVG gradient IDs per instance via React 19 useId()
 * 3. Dynamic `key` on <Svg> forces repaint when colors change on Web
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

  // ─── Dynamic brand colors from theme context ───
  let primaryColor: string | null = null;
  let secondaryColor: string | null = null;
  try {
    const themeContext = useThemeContext();
    primaryColor = themeContext?.primaryColor;
    secondaryColor = themeContext?.secondaryColor;
  } catch {
    // Silent fallback if outside provider
  }

  // ─── Watermark source resolution ───
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

  // ─── Gradient color computation ───
  const hasBrandColors = !!primaryColor || !!secondaryColor;
  const baseColor = primaryColor || colors.primary || "#F97316";
  const compColor = secondaryColor || (hasBrandColors ? "#D946EF" : "#FB923C");
  const accentColor = hasBrandColors ? "#4C1D95" : "#000000";

  // ─── Unique SVG IDs to avoid cross-instance collision on Web ───
  const instanceId = useId();
  const ids = useMemo(() => ({
    topLeft: `grad-tl-${instanceId}`,
    right: `grad-r-${instanceId}`,
    bottom: `grad-b-${instanceId}`,
  }), [instanceId]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        position: "relative",
      }}
      {...props}
    >
      {/* Layer 1: SVG Mesh Gradient — rendered first = sits behind everything */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <Svg
          key={`${baseColor}-${compColor}-${accentColor}`}
          height="100%"
          width="100%"
          style={{ width: "100%", height: "100%" }}
        >
          <Defs>
            <RadialGradient id={ids.topLeft} cx="0%" cy="10%" r="80%" fx="0%" fy="10%">
              <Stop offset="0%" stopColor={baseColor} stopOpacity="0.45" />
              <Stop offset="50%" stopColor={baseColor} stopOpacity="0.18" />
              <Stop offset="100%" stopColor={baseColor} stopOpacity="0" />
            </RadialGradient>

            <RadialGradient id={ids.right} cx="100%" cy="50%" r="90%" fx="100%" fy="50%">
              <Stop offset="0%" stopColor={compColor} stopOpacity="0.35" />
              <Stop offset="50%" stopColor={compColor} stopOpacity="0.12" />
              <Stop offset="100%" stopColor={compColor} stopOpacity="0" />
            </RadialGradient>

            <RadialGradient id={ids.bottom} cx="40%" cy="95%" r="75%" fx="40%" fy="95%">
              <Stop offset="0%" stopColor={accentColor} stopOpacity="0.30" />
              <Stop offset="60%" stopColor={accentColor} stopOpacity="0.08" />
              <Stop offset="100%" stopColor={accentColor} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Pure black base */}
          <Rect width="100%" height="100%" fill="#09090B" />

          {/* Layered radial glows */}
          <Rect width="100%" height="100%" fill={`url(#${ids.topLeft})`} />
          <Rect width="100%" height="100%" fill={`url(#${ids.right})`} />
          <Rect width="100%" height="100%" fill={`url(#${ids.bottom})`} />
        </Svg>
      </View>

      {/* Layer 2: Watermark (company logo) */}
      {watermarkSource ? (
        <Image
          source={{ uri: watermarkSource }}
          style={{
            position: "absolute",
            alignSelf: "center",
            top: "30%",
            width: 280,
            height: 280,
            opacity: 0.15,
            resizeMode: "contain",
            pointerEvents: "none",
          }}
        />
      ) : null}

      {/* Layer 3: Content */}
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
