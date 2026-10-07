import { useCallback, useEffect, useState } from "react";
import { AppState, Platform, Pressable, Text, View } from "react-native";
import { Card } from "@/components/ui/card";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { fontSize, fontWeight, radius, spacing } from "@/lib/design-tokens";
import {
  AppPermission,
  PERMISSION_LABELS,
  PermissionState,
  ensurePermission,
  getAllPermissionStates,
} from "@/lib/permissions";

const ICONS = {
  notifications: "bell.fill",
  location: "location.fill",
  camera: "camera.fill",
} as const;

const ORDER: AppPermission[] = ["notifications", "location", "camera"];

/** Status of the app permissions with a shortcut to grant each one (native only). */
export function PermissionsCard() {
  const colors = useColors();
  const [states, setStates] = useState<Record<AppPermission, PermissionState> | null>(null);

  const refresh = useCallback(() => {
    getAllPermissionStates().then(setStates);
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    refresh();
    // The user may change permissions in the system settings and come back.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  if (Platform.OS === "web" || !states) return null;

  return (
    <Card style={{ padding: spacing.lg, gap: spacing.md }}>
      <Text style={{ fontSize: fontSize.md + 1, color: colors.foreground, fontWeight: fontWeight.bold }}>
        Permissões do app
      </Text>
      {ORDER.map((permission) => {
        const granted = states[permission] === "granted";
        const { title, reason } = PERMISSION_LABELS[permission];
        return (
          <View key={permission} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
            <IconSymbol name={ICONS[permission]} size={22} color={colors.foreground} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.md, color: colors.foreground, fontWeight: fontWeight.semibold }}>{title}</Text>
              <Text style={{ fontSize: fontSize.sm, color: colors.muted }}>{reason}</Text>
            </View>
            {granted ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <IconSymbol name="checkmark" size={16} color={colors.success} />
                <Text style={{ fontSize: fontSize.sm, color: colors.success, fontWeight: fontWeight.semibold }}>Permitida</Text>
              </View>
            ) : (
              <Pressable
                onPress={async () => {
                  await ensurePermission(permission);
                  refresh();
                }}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.xs + 2,
                    borderRadius: radius.pill,
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: fontSize.sm, color: "#FFFFFF", fontWeight: fontWeight.bold }}>Permitir</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </Card>
  );
}
