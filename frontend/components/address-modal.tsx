import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { UserAddress } from "@/lib/types";
import { lookupCep } from "@/lib/api/rentals";

interface AddressModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAddress?: (address: UserAddress) => void;
}

export function AddressModal({ visible, onClose, onSelectAddress }: AddressModalProps) {
  const colors = useColors();
  const { savedAddresses, addAddress, updateAddress, deleteAddress, setDefaultAddress } = useApp();

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<UserAddress | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const openNewForm = () => {
    setEditingAddress(null);
    setTitle("");
    setCep("");
    setStreet("");
    setNumber("");
    setComplement("");
    setNeighborhood("");
    setCity("");
    setState("");
    setIsDefault(savedAddresses.length === 0);
    setShowFormModal(true);
  };

  const openEditForm = (addr: UserAddress) => {
    setEditingAddress(addr);
    setTitle(addr.title || "");
    setCep(addr.cep || "");
    setStreet(addr.street || "");
    setNumber(addr.number || "");
    setComplement(addr.complement || "");
    setNeighborhood(addr.neighborhood || "");
    setCity(addr.city || "");
    setState(addr.state || "");
    setIsDefault(!!addr.isDefault);
    setShowFormModal(true);
  };

  const handleCepChange = async (val: string) => {
    const formatted = val.replace(/\D/g, "").substring(0, 8);
    setCep(formatted);

    if (formatted.length === 8) {
      setIsLoadingCep(true);
      try {
        const addressData = await lookupCep(formatted);
        if (addressData) {
          setStreet(addressData.street || "");
          setNeighborhood(addressData.neighborhood || "");
          setCity(addressData.city || "");
          setState(addressData.state || "");
        }
      } catch (err: any) {
        Alert.alert("Erro", "Não foi possível encontrar o CEP informado.");
      } finally {
        setIsLoadingCep(false);
      }
    }
  };

  const handleSaveForm = async () => {
    if (!cep || cep.length !== 8) {
      Alert.alert("Erro", "CEP deve conter 8 dígitos.");
      return;
    }
    if (!street.trim()) {
      Alert.alert("Erro", "Nome da rua é obrigatório.");
      return;
    }
    if (!number.trim()) {
      Alert.alert("Erro", "Número da residência é obrigatório.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title: title.trim() || `${street}, ${number}`,
        cep,
        street: street.trim(),
        number: number.trim(),
        complement: complement.trim() || undefined,
        neighborhood: neighborhood.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase(),
        isDefault,
      };

      if (editingAddress) {
        await updateAddress(editingAddress.id, payload);
      } else {
        await addAddress(payload);
      }

      setShowFormModal(false);
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível salvar o endereço.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (addr: UserAddress) => {
    Alert.alert("Excluir Endereço", `Deseja remover o endereço "${addr.title || addr.street}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAddress(addr.id);
          } catch (err: any) {
            Alert.alert("Erro", err.message || "Não foi possível excluir.");
          }
        },
      },
    ]);
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%", paddingBottom: 24 }}>
            
            {/* Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <IconSymbol name="mappin.and.ellipse" size={22} color={colors.primary} />
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Meus Endereços Salvos</Text>
              </View>
              <Pressable onPress={onClose} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} showsVerticalScrollIndicator={false}>
              {savedAddresses.length === 0 ? (
                <View style={{ alignItems: "center", paddingVertical: 30, gap: 10 }}>
                  <IconSymbol name="mappin.slash" size={40} color={colors.muted} />
                  <Text style={{ fontSize: 15, color: colors.muted, textAlign: "center" }}>Nenhum endereço salvo encontrado.</Text>
                </View>
              ) : (
                savedAddresses.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      if (onSelectAddress) {
                        onSelectAddress(item);
                        onClose();
                      }
                    }}
                    style={({ pressed }) => [
                      {
                        padding: 14,
                        borderRadius: 14,
                        backgroundColor: colors.surface,
                        borderWidth: item.isDefault ? 2 : 1,
                        borderColor: item.isDefault ? colors.primary : colors.border,
                        gap: 8,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                          {item.title || `${item.street}, ${item.number}`}
                        </Text>
                        {item.isDefault && (
                          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.primary + "20" }}>
                            <Text style={{ fontSize: 10, fontWeight: "800", color: colors.primary }}>Padrão</Text>
                          </View>
                        )}
                      </View>

                      {/* Actions */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        {!item.isDefault && (
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              setDefaultAddress(item.id);
                            }}
                            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                          >
                            <IconSymbol name="star" size={18} color={colors.muted} />
                          </Pressable>
                        )}
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            openEditForm(item);
                          }}
                          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                        >
                          <IconSymbol name="pencil" size={18} color={colors.muted} />
                        </Pressable>
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(item);
                          }}
                          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                        >
                          <IconSymbol name="trash" size={18} color={colors.error} />
                        </Pressable>
                      </View>
                    </View>

                    <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "500" }}>
                      {item.street}, {item.number} {item.complement ? `- ${item.complement}` : ""}
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {item.neighborhood} · {item.city} / {item.state} · CEP: {item.cep}
                    </Text>

                    {onSelectAddress && (
                      <View style={{ alignSelf: "flex-end", marginTop: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>Usar este endereço →</Text>
                      </View>
                    )}
                  </Pressable>
                ))
              )}

              {/* Add New Address Button */}
              <Pressable
                onPress={openNewForm}
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 14,
                    borderRadius: 14,
                    backgroundColor: colors.primary + "15",
                    borderWidth: 1,
                    borderColor: colors.primary + "44",
                    opacity: pressed ? 0.85 : 1,
                    marginTop: 8,
                  },
                ]}
              >
                <IconSymbol name="plus" size={18} color={colors.primary} />
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.primary }}>Adicionar Novo Endereço</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Form Modal for Create/Edit */}
      <Modal visible={showFormModal} animationType="slide" transparent={true} onRequestClose={() => setShowFormModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>
                {editingAddress ? "Editar Endereço" : "Novo Endereço"}
              </Text>
              <Pressable onPress={() => setShowFormModal(false)}>
                <IconSymbol name="xmark" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={false}>
              <View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Nome do Endereço (ex: Casa, Trabalho)</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ex: Minha Casa"
                  placeholderTextColor={colors.muted}
                  style={{
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.foreground,
                    fontSize: 14,
                  }}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>CEP (8 dígitos)</Text>
                  <TextInput
                    value={cep}
                    onChangeText={handleCepChange}
                    placeholder="00000000"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    maxLength={8}
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: colors.foreground,
                      fontSize: 14,
                    }}
                  />
                </View>
                {isLoadingCep && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 18 }} />}
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 3 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Rua / Av.</Text>
                  <TextInput
                    value={street}
                    onChangeText={setStreet}
                    placeholder="Nome da rua"
                    placeholderTextColor={colors.muted}
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: colors.foreground,
                      fontSize: 14,
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Número</Text>
                  <TextInput
                    value={number}
                    onChangeText={setNumber}
                    placeholder="123"
                    placeholderTextColor={colors.muted}
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: colors.foreground,
                      fontSize: 14,
                    }}
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Complemento</Text>
                  <TextInput
                    value={complement}
                    onChangeText={setComplement}
                    placeholder="Apto, bloco..."
                    placeholderTextColor={colors.muted}
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: colors.foreground,
                      fontSize: 14,
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Bairro</Text>
                  <TextInput
                    value={neighborhood}
                    onChangeText={setNeighborhood}
                    placeholder="Bairro"
                    placeholderTextColor={colors.muted}
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: colors.foreground,
                      fontSize: 14,
                    }}
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 2 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>Cidade</Text>
                  <TextInput
                    value={city}
                    onChangeText={setCity}
                    placeholder="Cidade"
                    placeholderTextColor={colors.muted}
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: colors.foreground,
                      fontSize: 14,
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.muted, marginBottom: 4 }}>UF</Text>
                  <TextInput
                    value={state}
                    onChangeText={setState}
                    placeholder="SP"
                    placeholderTextColor={colors.muted}
                    maxLength={2}
                    autoCapitalize="characters"
                    style={{
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 10,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      color: colors.foreground,
                      fontSize: 14,
                    }}
                  />
                </View>
              </View>

              {/* Set Default Switch */}
              <Pressable
                onPress={() => setIsDefault(!isDefault)}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}
              >
                <IconSymbol
                  name={isDefault ? "checkmark.circle.fill" : "circle"}
                  size={20}
                  color={isDefault ? colors.primary : colors.muted}
                />
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>
                  Definir como endereço padrão
                </Text>
              </Pressable>

              {/* Save Button */}
              <Pressable
                onPress={handleSaveForm}
                disabled={isSaving}
                style={({ pressed }) => [
                  {
                    backgroundColor: colors.primary,
                    borderRadius: 14,
                    paddingVertical: 14,
                    alignItems: "center",
                    marginTop: 10,
                    opacity: pressed || isSaving ? 0.8 : 1,
                  },
                ]}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Salvar Endereço</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
