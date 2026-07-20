import { router } from "expo-router";
import React, { useEffect, useState, useMemo, useRef } from "react";
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
import { RentalTimer } from "@/components/rental-timer";
import {
  getAllCompanies,
  updateCompanyStatus,
  getCompanyRentals,
  cancelCompanyRental,
} from "@/lib/api/admin";

const ADMIN_STATUS_LABEL: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  pending: "Aguardando entrega",
  accepted: "Entrega ant. solicitada",
  rejected: "Recusado",
  delivering: "Em rota de entrega",
  delivered: "Entregue (Em uso)",
  active: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
  return_expired: "Devolução (Expirou)",
};

const ADMIN_STATUS_COLOR: Record<string, string> = {
  awaiting_payment: "#3B82F6",
  pending: "#F59E0B",
  accepted: "#8B5CF6",
  rejected: "#EF4444",
  delivering: "#F97316",
  delivered: "#22C55E",
  active: "#22C55E",
  completed: "#64748B",
  cancelled: "#6B7280",
  return_expired: "#EF4444",
};

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

  // Flag to prevent parent Pressable from navigating when cancel button is tapped
  const cancelTappedRef = useRef(false);

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
    Alert.alert(
      "Confirmar Aprovação",
      "Tem certeza que deseja aprovar esta empresa?",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim, Aprovar",
          onPress: async () => {
            try {
              await updateCompanyStatus(companyId, "approved");
              Alert.alert("Sucesso", "Empresa aprovada com sucesso!");
              fetchCompanies();
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Erro ao aprovar empresa.");
            }
          },
        },
      ]
    );
  };

  const handleReject = async (companyId: string) => {
    Alert.alert(
      "Confirmar Recusa",
      "Tem certeza que deseja recusar esta empresa?",
      [
        { text: "Não", style: "cancel" },
        {
          text: "Sim, Recusar",
          style: "destructive",
          onPress: async () => {
            try {
              await updateCompanyStatus(companyId, "rejected");
              Alert.alert("Sucesso", "Empresa recusada.");
              fetchCompanies();
            } catch (err: any) {
              Alert.alert("Erro", err.message || "Erro ao recusar empresa.");
            }
          },
        },
      ]
    );
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
    const nonCancelled = companyRentals.filter((r) => r.status !== "cancelled");
    const totalCount = companyRentals.length;
    const totalRevenue = nonCancelled.reduce((sum, r) => sum + r.totalPrice, 0);
    const activeCount = companyRentals.filter(
      (r) => r.status === "delivered" || r.status === "active"
    ).length;
    const completedCount = companyRentals.filter((r) => r.status === "completed").length;
    return { totalCount, totalRevenue, activeCount, completedCount };
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
              <View style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Total de Pedidos</Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>{stats.totalCount}</Text>
              </View>
              <View style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Em Uso Agora</Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.success }}>{stats.activeCount}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
              <View style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Concluídos</Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>{stats.completedCount}</Text>
              </View>
              <View style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Receita Estimada</Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>R$ {stats.totalRevenue.toFixed(2)}</Text>
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
                    <Pressable
                      onPress={() => {
                        if (cancelTappedRef.current) {
                          cancelTappedRef.current = false;
                          return;
                        }
                        setSelectedCompany(null);
                        router.push(`/order/${item.id}`);
                      }}
                      style={({ pressed }) => [
                        {
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                          gap: 8,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      {/* Header row: tool info + status badge + cancel button */}
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
                            {item.toolName}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.muted }}>
                            Cliente: {item.customerName}
                          </Text>
                          <Text style={{ fontSize: 12, color: colors.muted }}>
                            {item.days}d · R$ {item.totalPrice.toFixed(2)}
                            {item.shippingPrice && item.shippingPrice > 0 ? ` (+ R$ ${item.shippingPrice.toFixed(2)} frete)` : " (retirada no local)"}
                          </Text>
                          {item.customerNote ? (
                            <Text style={{ fontSize: 11, color: colors.muted, fontStyle: "italic" }} numberOfLines={1}>
                              Obs: {item.customerNote}
                            </Text>
                          ) : null}
                        </View>
                        <View style={{ gap: 6, alignItems: "flex-end" }}>
                          <View style={{
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 8,
                            backgroundColor: (ADMIN_STATUS_COLOR[item.status] || colors.muted) + "20",
                          }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: ADMIN_STATUS_COLOR[item.status] || colors.muted }}>
                              {ADMIN_STATUS_LABEL[item.status] || item.status}
                            </Text>
                          </View>
                          {/* Cancel button — replaces the early-delivery slot, sits where that action would be */}
                          {item.status !== "cancelled" && item.status !== "completed" ? (
                            <Pressable
                              onPress={() => {
                                cancelTappedRef.current = true;
                                handleCancelRental(item.id);
                              }}
                              style={({ pressed }) => [
                                {
                                  paddingHorizontal: 10,
                                  paddingVertical: 5,
                                  borderRadius: 8,
                                  backgroundColor: "#EF444415",
                                  opacity: pressed ? 0.7 : 1,
                                },
                              ]}
                            >
                              <Text style={{ fontSize: 11, fontWeight: "700", color: "#EF4444" }}>Cancelar</Text>
                            </Pressable>
                          ) : (
                            <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                          )}
                        </View>
                      </View>

                      {/* Active timer for delivered/active rentals */}
                      {item.deliveredAt && (item.status === "delivered" || item.status === "active") && (
                        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 6, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600" }}>Tempo Restante:</Text>
                          <RentalTimer deliveredAt={item.deliveredAt} days={item.days} />
                        </View>
                      )}
                    </Pressable>
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
