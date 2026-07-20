import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, Text, View, Platform, Alert, Image, Modal, TextInput } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { spacing, fontSize, fontWeight, radius, pageTitle } from "@/lib/design-tokens";

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

  const uploadAvatar = async (urlOrBase64: string) => {
    if (isUpdatingAvatar) return;
    setIsUpdatingAvatar(true);
    try {
      // No palette extraction for customer profiles — brand colors handled server-side
      await updateAvatar(urlOrBase64);
      Alert.alert("Sucesso", "Foto de perfil atualizada!");
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Erro ao atualizar foto.");
    } finally {
      setIsUpdatingAvatar(false);
    }
  };

  return (
    <ScreenContainer className="p-4">
      <Text style={[pageTitle(colors), { marginBottom: spacing.xl }]}>
        Perfil
      </Text>

      {user ? (
        <View style={{ gap: spacing.lg }}>
          {/* User info card */}
          <Card style={{ padding: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg - 2 }}>
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
                    borderWidth: 0.5,
                    borderColor: colors.border,
                  },
                ]}
              >
                {user.avatarUrl || myCompany?.logo ? (
                  <Image source={{ uri: user.avatarUrl || myCompany?.logo }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                ) : (
                  <Text style={{ color: "#fff", fontSize: 22, fontWeight: fontWeight.black }}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                )}
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: fontWeight.bold, color: colors.foreground }}>{user.name}</Text>
                <Text style={{ fontSize: fontSize.sm, color: colors.muted }}>{user.email}</Text>
                <Badge
                  variant="primary"
                  style={{ marginTop: spacing.xs }}
                >
                  {user.profile === "company" ? "Empresa" : user.profile === "deliverer" ? "Entregador" : "Cliente"}
                </Badge>
              </View>
            </View>
          </Card>

          {/* Admin panel link */}
          {user.isOwner && (
            <Card
              onPress={() => router.push("/dashboard-owner")}
              style={{ padding: spacing.lg }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconSymbol name="shield.fill" size={22} color={colors.primary} />
                <Text style={{ flex: 1, fontSize: fontSize.md + 1, color: colors.foreground, fontWeight: fontWeight.semibold }}>
                  Painel do Administrador
                </Text>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </View>
            </Card>
          )}

          {/* Company store status toggle */}
          {myCompany && (
            <Card style={{ padding: spacing.lg }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconSymbol name="storefront.fill" size={22} color={colors.foreground} />
                <Text style={{ flex: 1, fontSize: fontSize.md + 1, color: colors.foreground, fontWeight: fontWeight.medium }}>
                  Status da Loja: {myCompany.isOpen ? "Aberta" : "Fechada"}
                </Text>
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
              </View>
            </Card>
          )}

          {/* Logout button */}
          <Button
            variant="destructive"
            onPress={() => {
              logout();
              router.replace("/");
            }}
          >
            Sair da conta
          </Button>
        </View>
      ) : (
        <EmptyState
          icon="person.fill"
          title="Você não está logado"
          description="Navegue livremente. O login só é necessário ao alugar uma ferramenta."
          actionLabel="Entrar ou criar conta"
          onAction={() => router.push("/auth")}
        />
      )}

      {/* Modal for Avatar URL Input */}
      <Modal visible={showUrlModal} transparent={true} animationType="slide" onRequestClose={() => setShowUrlModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, gap: spacing.lg }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: fontWeight.black, color: colors.foreground }}>Inserir URL da Foto</Text>
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
                borderRadius: radius.md,
                paddingHorizontal: spacing.lg - 2,
                paddingVertical: spacing.md,
                color: colors.foreground,
              }}
            />

            <Button
              onPress={() => {
                setShowUrlModal(false);
                if (urlInput.trim()) {
                  uploadAvatar(urlInput.trim());
                }
              }}
            >
              Salvar
            </Button>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
