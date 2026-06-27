import { router } from "expo-router";
import { Pressable, Switch, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { useThemeContext } from "@/lib/theme-provider";

export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout } = useApp();
  const themeMode = useThemeContext();

  return (
    <ScreenContainer className="p-4">
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 20 }}>
        Perfil
      </Text>

      {user ? (
        <View style={{ gap: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              padding: 16,
              borderRadius: 16,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>
                {user.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>{user.name}</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>{user.email}</Text>
              <View style={{ alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: colors.primary + "22" }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>
                  {user.profile === "company" ? "Empresa" : "Cliente"}
                </Text>
              </View>
            </View>
          </View>

          <Row
            icon="gearshape.fill"
            label="Modo escuro"
            right={
              <Switch
                value={themeMode.colorScheme === "dark"}
                onValueChange={(v) => themeMode.setColorScheme(v ? "dark" : "light")}
                trackColor={{ true: colors.primary }}
              />
            }
          />

          <Pressable
            onPress={() => {
              logout();
              router.replace("/");
            }}
            style={({ pressed }) => [
              {
                marginTop: 8,
                paddingVertical: 15,
                borderRadius: 14,
                alignItems: "center",
                backgroundColor: colors.error + "18",
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={{ color: colors.error, fontWeight: "700", fontSize: 15 }}>Sair da conta</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ alignItems: "center", marginTop: 60, gap: 14 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
            <IconSymbol name="person.fill" size={38} color={colors.muted} />
          </View>
          <Text style={{ fontSize: 16, color: colors.foreground, fontWeight: "600" }}>Você não está logado</Text>
          <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center", paddingHorizontal: 30 }}>
            Navegue livremente. O login só é necessário ao alugar uma ferramenta.
          </Text>
          <Pressable
            onPress={() => router.push("/auth")}
            style={({ pressed }) => [
              { marginTop: 6, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Entrar ou criar conta</Text>
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  );
}

function Row({ icon, label, right }: { icon: any; label: string; right?: React.ReactNode }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 16,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <IconSymbol name={icon} size={22} color={colors.foreground} />
      <Text style={{ flex: 1, fontSize: 15, color: colors.foreground, fontWeight: "500" }}>{label}</Text>
      {right}
    </View>
  );
}
