import { router } from "expo-router";
import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { Company, Rental } from "@/lib/types";
import {
  getAllCompanies,
  updateCompanyStatus,
  getCompanyRentals,
  cancelCompanyRental,
} from "@/lib/api/admin";

export default function DashboardOwnerScreen() {
  const colors = useColors();
  const { user, logout } = useApp();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Selected company modal state
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyRentals, setCompanyRentals] = useState<Rental[]>([]);
  const [isLoadingRentals, setIsLoadingRentals] = useState(false);

  // Check permissions: must be owner
  useEffect(() => {
    if (user && !user.isOwner) {
      Alert.alert("Acesso Negado", "Apenas administradores do sistema podem acessar esta tela.");
      router.replace("/");
    }
  }, [user]);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const data = await getAllCompanies();
      setCompanies(data);
    } catch (err: any) {
      Alert.alert("Erro", "Não foi possível carregar as empresas.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleApprove = async (companyId: string) => {
    try {
      await updateCompanyStatus(companyId, "approved");
      Alert.alert("Sucesso", "Empresa aprovada com sucesso!");
      fetchCompanies();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Erro ao aprovar empresa.");
    }
  };

  const handleReject = async (companyId: string) => {
    try {
      await updateCompanyStatus(companyId, "rejected");
      Alert.alert("Sucesso", "Empresa recusada.");
      fetchCompanies();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Erro ao recusar empresa.");
    }
  };

  const handleSelectCompany = async (company: Company) => {
    setSelectedCompany(company);
    setIsLoadingRentals(true);
    try {
      const rentalsData = await getCompanyRentals(company.id);
      setCompanyRentals(rentalsData);
    } catch (err) {
      Alert.alert("Erro", "Não foi possível carregar os pedidos da empresa.");
    } finally {
      setIsLoadingRentals(false);
    }
  };

  const handleCancelRental = async (rentalId: string) => {
    if (!selectedCompany) return;
    Alert.alert(
      "Confirmar Cancelamento",
      "Tem certeza que deseja cancelar este aluguel de forma administrativa?",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim, Cancelar",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelCompanyRental(selectedCompany.id, rentalId);
              Alert.alert("Sucesso", "Pedido cancelado com sucesso!");
              // Refresh rentals list
              const rentalsData = await getCompanyRentals(selectedCompany.id);
              setCompanyRentals(rentalsData);
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Não foi possível cancelar o pedido.");
            }
          },
        },
      ]
    );
  };

  const pendingCompanies = useMemo(
    () => companies.filter((c) => c.status === "pending"),
    [companies]
  );

  const stats = useMemo(() => {
    const activeRentals = companyRentals.filter((r) => r.status !== "cancelled");
    const totalCount = companyRentals.length;
    const totalRevenue = activeRentals.reduce((sum, r) => sum + r.totalPrice, 0);
    return { totalCount, totalRevenue };
  }, [companyRentals]);

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      {/* Top Header */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>
          Painel do Administrador
        </Text>
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            {
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: colors.border,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>Sair</Text>
        </Pressable>
      </View>

      {/* Tabs Layout */}
      <View style={{ flexDirection: "row", padding: 8, gap: 8 }}>
        <Pressable
          onPress={() => setTab("pending")}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: tab === "pending" ? colors.primary : colors.surface,
            borderWidth: 1,
            borderColor: tab === "pending" ? colors.primary : colors.border,
          }}
        >
          <Text
            style={{
              color: tab === "pending" ? "#fff" : colors.foreground,
              fontWeight: "700",
              fontSize: 13,
            }}
          >
            Pendentes ({pendingCompanies.length})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setTab("all")}
          style={{
            flex: 1,
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: tab === "all" ? colors.primary : colors.surface,
            borderWidth: 1,
            borderColor: tab === "all" ? colors.primary : colors.border,
          }}
        >
          <Text
            style={{
              color: tab === "all" ? "#fff" : colors.foreground,
              fontWeight: "700",
              fontSize: 13,
            }}
          >
            Todas ({companies.length})
          </Text>
        </Pressable>
      </View>

      {/* Loading state */}
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={tab === "pending" ? pendingCompanies : companies}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 14 }}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: colors.muted, marginTop: 40 }}>
              Nenhuma empresa encontrada nesta categoria.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelectCompany(item)}
              style={({ pressed }) => [
                {
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <View style={{ flex: 1, flexDirection: "row", gap: 12, alignItems: "center" }}>
                <Image
                  source={{ uri: item.logo || "sem-imagem" }}
                  style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: colors.border }}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
                    {item.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.muted }} numberOfLines={1}>
                    {item.location} · {item.description}
                  </Text>
                  {tab === "all" && (
                    <View
                      style={{
                        alignSelf: "flex-start",
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                        backgroundColor:
                          item.status === "approved"
                            ? colors.success + "15"
                            : item.status === "rejected"
                            ? "#EF444415"
                            : "#F59E0B15",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color:
                            item.status === "approved"
                              ? colors.success
                              : item.status === "rejected"
                              ? "#EF4444"
                              : "#F59E0B",
                        }}
                      >
                        {item.status === "approved"
                          ? "Aprovado"
                          : item.status === "rejected"
                          ? "Recusado"
                          : "Pendente"}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {item.status === "pending" && (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={() => handleReject(item.id)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: "#EF444415",
                    }}
                  >
                    <IconSymbol name="xmark" size={16} color="#EF4444" />
                  </Pressable>
                  <Pressable
                    onPress={() => handleApprove(item.id)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 8,
                      backgroundColor: colors.success + "15",
                    }}
                  >
                    <IconSymbol name="checkmark" size={16} color={colors.success} />
                  </Pressable>
                </View>
              )}
            </Pressable>
          )}
        />
      )}

      {/* Statistics & Control Modal */}
      {selectedCompany && (
        <Modal
          visible={true}
          animationType="slide"
          onRequestClose={() => setSelectedCompany(null)}
        >
          <ScreenContainer edges={["top", "left", "right"]}>
            {/* Modal Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Image
                  source={{ uri: selectedCompany.logo }}
                  style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: colors.border }}
                />
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>
                  {selectedCompany.name}
                </Text>
              </View>
              <Pressable
                onPress={() => setSelectedCompany(null)}
                style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
              >
                <IconSymbol name="xmark" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Metrics cards */}
            <View style={{ flexDirection: "row", padding: 16, gap: 12 }}>
              <View
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>
                  Total de Pedidos
                </Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>
                  {stats.totalCount}
                </Text>
              </View>

              <View
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>
                  Receita Estimada
                </Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>
                  R$ {stats.totalRevenue.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Rentals List */}
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: colors.foreground,
                  marginBottom: 12,
                }}
              >
                Controle de Pedidos
              </Text>

              {isLoadingRentals ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
              ) : (
                <FlatList
                  data={companyRentals}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
                  ListEmptyComponent={
                    <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
                      Nenhum pedido realizado para esta empresa.
                    </Text>
                  }
                  renderItem={({ item }) => (
                    <View
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
                          {item.toolName}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.muted }}>
                          Cliente: {item.customerName} · Valor: R$ {item.totalPrice.toFixed(2)}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "700",
                              color: item.status === "cancelled" ? "#EF4444" : colors.primary,
                            }}
                          >
                            {item.status === "cancelled" ? "Cancelado" : "Ativo"}
                          </Text>
                        </View>
                      </View>

                      {item.status !== "cancelled" && (
                        <Pressable
                          onPress={() => handleCancelRental(item.id)}
                          style={({ pressed }) => [
                            {
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 8,
                              backgroundColor: "#EF444415",
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#EF4444" }}>
                            Cancelar
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                />
              )}
            </View>
          </ScreenContainer>
        </Modal>
      )}
    </ScreenContainer>
  );
}
