import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, Text, View, Platform, Alert, Image, Modal, TextInput } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { useThemeContext } from "@/lib/theme-provider";
import { extractPalette, adjustContrast } from "@/lib/utils";

export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout, companies, updateAvatar, updateCompanyStatus, refreshCatalog } = useApp();
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState(user?.avatarUrl || "");

  const myCompany = user?.profile === "company" && user.companyId 
    ? companies.find((c) => c.id === user.companyId) 
    : null;

  const handleUploadImage = () => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = reader.result as string;
            await uploadAvatar(base64);
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      setUrlInput(user?.avatarUrl || "");
      setShowUrlModal(true);
    }
  };

  const { colorScheme } = useThemeContext();

  const uploadAvatar = async (urlOrBase64: string) => {
    if (isUpdatingAvatar) return;
    setIsUpdatingAvatar(true);
    try {
      let primaryAdjusted: string | null = null;
      let secondaryAdjusted: string | null = null;

      if (user?.profile === "company") {
        const palette = await extractPalette(urlOrBase64);
        const isDark = colorScheme === "dark";
        primaryAdjusted = adjustContrast(palette.primary, isDark);
        secondaryAdjusted = adjustContrast(palette.secondary, isDark);
      }

      await updateAvatar(urlOrBase64, primaryAdjusted, secondaryAdjusted);
      Alert.alert("Sucesso", "Foto de perfil atualizada!");
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Erro ao atualizar foto.");
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

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
            <Pressable
              onPress={handleUploadImage}
              style={({ pressed }) => [
                {
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  opacity: pressed || isUpdatingAvatar ? 0.8 : 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
            >
              {user.avatarUrl || myCompany?.logo ? (
                <Image source={{ uri: user.avatarUrl || myCompany?.logo }} style={{ width: "100%", height: "100%" }} />
              ) : (
                <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              )}
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground }}>{user.name}</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>{user.email}</Text>
              <View style={{ alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: colors.primary + "22" }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>
                  {user.profile === "company" ? "Empresa" : user.profile === "deliverer" ? "Entregador" : "Cliente"}
                </Text>
              </View>
            </View>
          </View>

          {user.isOwner && (
            <Pressable
              onPress={() => router.push("/dashboard-owner")}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <IconSymbol name="shield.fill" size={22} color={colors.primary} />
              <Text style={{ flex: 1, fontSize: 15, color: colors.foreground, fontWeight: "600" }}>
                Painel do Administrador
              </Text>
              <IconSymbol name="chevron.right" size={20} color={colors.muted} />
            </Pressable>
          )}

          {myCompany && (
            <Row
              icon="storefront.fill"
              label={`Status da Loja: ${myCompany.isOpen ? "Aberta" : "Fechada"}`}
              right={
                <Switch
                  value={myCompany.isOpen}
                  onValueChange={async (v) => {
                    try {
                      await updateCompanyStatus(v);
                      await refreshCatalog();
                    } catch (err: any) {
                      Alert.alert("Erro", "Não foi possível alterar o status.");
                    }
                  }}
                  trackColor={{ true: colors.success + "50", false: colors.error + "50" }}
                  thumbColor={myCompany.isOpen ? colors.success : colors.error}
                />
              }
            />
          )}

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
      {/* Modal for Avatar URL Input */}
      <Modal visible={showUrlModal} transparent={true} animationType="slide" onRequestClose={() => setShowUrlModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Inserir URL da Foto</Text>
              <Pressable onPress={() => setShowUrlModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="https://exemplo.com/foto.jpg"
              placeholderTextColor={colors.muted}
              style={{
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                color: colors.foreground,
              }}
            />

            <Pressable
              onPress={() => {
                setShowUrlModal(false);
                if (urlInput.trim()) {
                  uploadAvatar(urlInput.trim());
                }
              }}
              style={({ pressed }) => [
                { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Salvar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
