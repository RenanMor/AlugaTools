import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, Text, View, Platform, Alert, Image, Modal, TextInput } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { AddressModal } from "@/components/address-modal";
import { PaymentInfoModal } from "@/components/payment-info-modal";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { spacing, fontSize, fontWeight, radius, pageTitle } from "@/lib/design-tokens";
import { compressImage, extractPalette } from "@/lib/utils";

export default function ProfileScreen() {
  const colors = useColors();
  const { user, logout, companies, updateAvatar, updateCompanyStatus, updateCompanyDescription, refreshCatalog } = useApp();
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDescriptionModal, setShowDescriptionModal] = useState(false);
  const [descriptionInput, setDescriptionInput] = useState("");
  const [isSavingDescription, setIsSavingDescription] = useState(false);
  const [urlInput, setUrlInput] = useState(user?.avatarUrl || "");

  const isClient = user?.profile === "customer";

  const myCompany = user?.profile === "company" && user.companyId 
    ? companies.find((c) => c.id === user.companyId) 
    : null;

  const handleUploadImage = () => {
    if (isClient) return;
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          await uploadAvatar(file);
        }
      };
      input.click();
    } else {
      setUrlInput(user?.avatarUrl || "");
      setShowUrlModal(true);
    }
  };

  const uploadAvatar = async (fileOrUrl: any) => {
    if (isClient || isUpdatingAvatar) return;
    setIsUpdatingAvatar(true);
    try {
      // 1. Resize and compress to avoid huge base64 strings in DB/storage
      const compressed = await compressImage(fileOrUrl, 512, 512, 0.85);
      const finalImage = compressed || fileOrUrl;

      // 2. Extract brand color palette from the image
      const palette = await extractPalette(finalImage);

      // 3. Update avatar and brand colors
      await updateAvatar(finalImage, palette.primary, palette.secondary);
      Alert.alert("Sucesso", "Foto da empresa atualizada!");
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
                disabled={isClient || isUpdatingAvatar}
                style={({ pressed }) => [
                  {
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    backgroundColor: colors.surface,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    opacity: isClient ? 1 : pressed || isUpdatingAvatar ? 0.8 : 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    position: "relative",
                  },
                ]}
              >
                {isClient ? (
                  <Image
                    source={require("@/assets/images/default-avatar-client.png")}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                ) : user.avatarUrl || myCompany?.logo ? (
                  <Image
                    source={{ uri: user.avatarUrl || myCompany?.logo }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="contain"
                  />
                ) : (
                  <Text style={{ color: "#fff", fontSize: 22, fontWeight: fontWeight.black }}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                )}
                {!isClient && (
                  <View
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: "rgba(0, 0, 0, 0.55)",
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 2,
                    }}
                  >
                    <IconSymbol name="camera.fill" size={10} color="#fff" />
                  </View>
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

          {/* User saved addresses card — hidden for company profiles */}
          {!myCompany && (
            <Card
              onPress={() => setShowAddressModal(true)}
              style={{ padding: spacing.lg }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconSymbol name="mappin.and.ellipse" size={22} color={colors.primary} />
                <Text style={{ flex: 1, fontSize: fontSize.md + 1, color: colors.foreground, fontWeight: fontWeight.semibold }}>
                  Meus Endereços Salvos
                </Text>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </View>
            </Card>
          )}

          {/* Company description card */}
          {myCompany && (
            <Card
              onPress={() => {
                setDescriptionInput(myCompany.description || "");
                setShowDescriptionModal(true);
              }}
              style={{ padding: spacing.lg }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconSymbol name="text.alignleft" size={22} color={colors.primary} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: fontSize.md + 1, color: colors.foreground, fontWeight: fontWeight.semibold }}>
                    Descrição da Empresa
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: fontSize.xs + 1, color: colors.muted }}
                  >
                    {myCompany.description?.trim() || "Toque para adicionar uma descrição..."}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </View>
            </Card>
          )}

          {/* Company payment methods card */}
          {myCompany && (
            <Card
              onPress={() => setShowPaymentModal(true)}
              style={{ padding: spacing.lg }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconSymbol name="creditcard.fill" size={22} color={colors.primary} />
                <Text style={{ flex: 1, fontSize: fontSize.md + 1, color: colors.foreground, fontWeight: fontWeight.semibold }}>
                  Formas de Receber
                </Text>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </View>
            </Card>
          )}

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

      {/* Modal for User Addresses */}
      <AddressModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />

      {/* Modal: Formas de Receber (read-only) */}
      <PaymentInfoModal
        visible={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        company={myCompany || null}
      />

      {/* Modal: Descrição da Empresa */}
      <Modal
        visible={showDescriptionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDescriptionModal(false)}
      >
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.xl,
              gap: spacing.lg,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: fontWeight.black, color: colors.foreground }}>
                Descrição da Empresa
              </Text>
              <Pressable onPress={() => setShowDescriptionModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <TextInput
              value={descriptionInput}
              onChangeText={setDescriptionInput}
              placeholder="Descreva sua empresa, serviços e diferenciais..."
              placeholderTextColor={colors.muted}
              multiline
              numberOfLines={5}
              maxLength={500}
              style={{
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.lg - 2,
                paddingVertical: spacing.md,
                color: colors.foreground,
                minHeight: 110,
                textAlignVertical: "top",
              }}
            />
            <Text style={{ fontSize: fontSize.xs, color: colors.muted, textAlign: "right", marginTop: -spacing.sm }}>
              {descriptionInput.length}/500
            </Text>

            <Button
              onPress={async () => {
                if (isSavingDescription) return;
                setIsSavingDescription(true);
                try {
                  await updateCompanyDescription(descriptionInput.trim());
                  setShowDescriptionModal(false);
                  Alert.alert("Sucesso", "Descrição atualizada!");
                } catch (err: any) {
                  Alert.alert("Erro", err.message || "Não foi possível salvar a descrição.");
                } finally {
                  setIsSavingDescription(false);
                }
              }}
            >
              {isSavingDescription ? "Salvando..." : "Salvar Descrição"}
            </Button>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
