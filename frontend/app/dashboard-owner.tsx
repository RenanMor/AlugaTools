import { router, useFocusEffect } from "expo-router";
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { Company, Rental } from "@/lib/types";
import { RentalTimer } from "@/components/rental-timer";
import { formatOrderId } from "@/lib/utils";
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
  return_expired: "Tempo expirado, entregador a caminho",
};

const ADMIN_STATUS_COLOR: Record<string, string> = {
  awaiting_payment: "#3B82F6",
  pending: "#F59E0B",
  accepted: "#8B5CF6",
  rejected: "#EF4444",
  delivering: "#F97316",
  delivered: "#22C55E",
  active: "#22C55E",
  completed: "#22C55E",
  cancelled: "#EF4444",
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
  const [inspectingCompany, setInspectingCompany] = useState<Company | null>(null);
  const activeCompanyRef = useRef<Company | null>(null);
  const [companyRentals, setCompanyRentals] = useState<Rental[]>([]);
  const [isLoadingRentals, setIsLoadingRentals] = useState(false);
  const [rentalSearchQuery, setRentalSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed">("all");

  // Re-open company modal when returning back from order details
  useFocusEffect(
    useCallback(() => {
      if (activeCompanyRef.current) {
        setSelectedCompany(activeCompanyRef.current);
      }
    }, [])
  );

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
    // Real-time polling: auto-refresh companies list every 3 seconds
    const interval = setInterval(() => {
      getAllCompanies().then(setCompanies).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Real-time polling for selected company's rentals every 3 seconds
  useEffect(() => {
    if (!selectedCompany) return;
    const pollSelected = async () => {
      try {
        const data = await getCompanyRentals(selectedCompany.id);
        setCompanyRentals(data);
      } catch (err) {
        // silent error on background poll
      }
    };
    const interval = setInterval(pollSelected, 3000);
    return () => clearInterval(interval);
  }, [selectedCompany?.id]);

  const handleApprove = async (companyId: string) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Tem certeza que deseja aprovar esta empresa?")) {
        try {
          await updateCompanyStatus(companyId, "approved");
          alert("Empresa aprovada com sucesso!");
          fetchCompanies();
        } catch (err: any) {
          alert(err.message || "Erro ao aprovar empresa.");
        }
      }
      return;
    }

    Alert.alert(
      "Confirmar Aprovação",
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
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Tem certeza que deseja recusar esta empresa?")) {
        try {
          await updateCompanyStatus(companyId, "rejected");
          alert("Empresa recusada.");
          fetchCompanies();
        } catch (err: any) {
          alert(err.message || "Erro ao recusar empresa.");
        }
      }
      return;
    }

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
    activeCompanyRef.current = company;
    setSelectedCompany(company);
    setRentalSearchQuery("");
    setStatusFilter("all");
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

  const handleCloseModal = () => {
    activeCompanyRef.current = null;
    setSelectedCompany(null);
  };

  const handleOpenRentalDetails = (rentalId: string) => {
    setSelectedCompany(null);
    router.push(`/order/${rentalId}`);
  };

  const handleCancelRental = async (rentalId: string) => {
    if (!selectedCompany) return;

    const performCancel = async () => {
      try {
        await cancelCompanyRental(selectedCompany.id, rentalId);
        if (Platform.OS === "web") {
          window.alert("Pedido cancelado com sucesso!");
        } else {
          Alert.alert("Sucesso", "Pedido cancelado com sucesso!");
        }
        // Refresh rentals list
        const rentalsData = await getCompanyRentals(selectedCompany.id);
        setCompanyRentals(rentalsData);
      } catch (err: any) {
        if (Platform.OS === "web") {
          window.alert(err.message || "Não foi possível cancelar o pedido.");
        } else {
          Alert.alert("Erro", err.message || "Não foi possível cancelar o pedido.");
        }
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Confirmar Cancelamento\n\nTem certeza que deseja cancelar este aluguel de forma administrativa?")) {
        performCancel();
      }
    } else {
      Alert.alert(
        "Confirmar Cancelamento",
        "Tem certeza que deseja cancelar este aluguel de forma administrativa?",
        [
          { text: "Não", style: "cancel" },
          {
            text: "Sim, Cancelar",
            style: "destructive",
            onPress: performCancel,
          },
        ]
      );
    }
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

  const filteredCompanyRentals = useMemo(() => {
    return companyRentals.filter((r) => {
      // 1. Status filter
      if (statusFilter === "active") {
        const isActive = r.status === "delivered" || r.status === "active";
        if (!isActive) return false;
      } else if (statusFilter === "completed") {
        if (r.status !== "completed") return false;
      }

      // 2. Search query filter
      if (rentalSearchQuery.trim()) {
        const q = rentalSearchQuery.trim().toLowerCase().replace(/^pedido#/i, "");
        const formattedId = formatOrderId(r.id).toLowerCase();
        const rawId = r.id.toLowerCase();
        const toolName = (r.toolName || "").toLowerCase();
        const customerName = (r.customerName || "").toLowerCase();
        const matchesSearch =
          formattedId.includes(q) ||
          rawId.includes(q) ||
          toolName.includes(q) ||
          customerName.includes(q);
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [companyRentals, statusFilter, rentalSearchQuery]);

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
              onPress={() => {
                if (item.status === "pending") {
                  setInspectingCompany(item);
                } else {
                  handleSelectCompany(item);
                }
              }}
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
                  resizeMode="contain"
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
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginLeft: 8 }}>
                  <Pressable
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      handleReject(item.id);
                    }}
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: "#EF444415",
                        borderWidth: 1,
                        borderColor: "#EF444440",
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <IconSymbol name="xmark" size={16} color="#EF4444" />
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#EF4444" }}>Recusar</Text>
                  </Pressable>

                  <Pressable
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      handleApprove(item.id);
                    }}
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: colors.success + "20",
                        borderWidth: 1,
                        borderColor: colors.success + "50",
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <IconSymbol name="checkmark" size={16} color={colors.success} />
                    <Text style={{ fontSize: 13, fontWeight: "800", color: colors.success }}>Aprovar</Text>
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
          onRequestClose={handleCloseModal}
        >
          <ScreenContainer edges={["top", "left", "right"]}>
            {/* Modal Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Pressable
                onPress={handleCloseModal}
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconSymbol name="arrow.left" size={18} color={colors.foreground} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>Voltar</Text>
              </Pressable>

              <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 8 }}>
                <Image
                  source={{ uri: selectedCompany.logo }}
                  style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: colors.border }}
                  resizeMode="contain"
                />
                <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>
                  {selectedCompany.name}
                </Text>
              </View>

              <Pressable
                onPress={handleCloseModal}
                style={({ pressed }) => [
                  {
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconSymbol name="xmark" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Metrics cards (Clickable filters) */}
            <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 12 }}>
              <Pressable
                onPress={() => setStatusFilter("all")}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: statusFilter === "all" ? colors.primary + "15" : colors.surface,
                    borderWidth: statusFilter === "all" ? 2 : 1,
                    borderColor: statusFilter === "all" ? colors.primary : colors.border,
                    gap: 4,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, color: statusFilter === "all" ? colors.primary : colors.muted, fontWeight: "700" }}>Total de Pedidos</Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>{stats.totalCount}</Text>
              </Pressable>

              <Pressable
                onPress={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: statusFilter === "active" ? colors.success + "15" : colors.surface,
                    borderWidth: statusFilter === "active" ? 2 : 1,
                    borderColor: statusFilter === "active" ? colors.success : colors.border,
                    gap: 4,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 12, color: statusFilter === "active" ? colors.success : colors.muted, fontWeight: "700" }}>
                    Em Uso Agora
                  </Text>
                  {statusFilter === "active" && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
                  )}
                </View>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.success }}>{stats.activeCount}</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
              <Pressable
                onPress={() => setStatusFilter(statusFilter === "completed" ? "all" : "completed")}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: statusFilter === "completed" ? colors.success + "15" : colors.surface,
                    borderWidth: statusFilter === "completed" ? 2 : 1,
                    borderColor: statusFilter === "completed" ? colors.success : colors.border,
                    gap: 4,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 12, color: statusFilter === "completed" ? colors.success : colors.muted, fontWeight: "700" }}>
                    Concluídos
                  </Text>
                  {statusFilter === "completed" && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
                  )}
                </View>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>{stats.completedCount}</Text>
              </Pressable>

              <View style={{ flex: 1, padding: 14, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 4 }}>
                <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Receita Estimada</Text>
                <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>R$ {stats.totalRevenue.toFixed(2)}</Text>
              </View>
            </View>

            {/* Rentals List */}
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "700",
                    color: colors.foreground,
                  }}
                >
                  Controle de Pedidos
                </Text>
                {statusFilter !== "all" && (
                  <Pressable onPress={() => setStatusFilter("all")}>
                    <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "700" }}>
                      Limpar filtro ({statusFilter === "active" ? "Em Uso" : "Concluídos"})
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Search input for company orders */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  marginBottom: 12,
                  gap: 8,
                }}
              >
                <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
                <TextInput
                  value={rentalSearchQuery}
                  onChangeText={setRentalSearchQuery}
                  placeholder="Buscar pedido por ID (Ex: Pedido#466B66C9)..."
                  placeholderTextColor={colors.muted}
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: colors.foreground,
                    padding: 0,
                  }}
                />
                {rentalSearchQuery.length > 0 && (
                  <Pressable onPress={() => setRentalSearchQuery("")}>
                    <IconSymbol name="xmark" size={16} color={colors.muted} />
                  </Pressable>
                )}
              </View>

              {isLoadingRentals ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
              ) : (
                <FlatList
                  data={filteredCompanyRentals}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
                  ListEmptyComponent={
                    <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
                      {rentalSearchQuery ? `Nenhum pedido encontrado para "${rentalSearchQuery}".` : "Nenhum pedido realizado para esta empresa."}
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
                        gap: 8,
                      }}
                    >
                      {/* Header row: tool info + status badge + cancel button */}
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Pressable
                          onPress={() => handleOpenRentalDetails(item.id)}
                          style={({ pressed }) => [{ flex: 1, gap: 4, opacity: pressed ? 0.7 : 1 }]}
                        >
                          <View style={{ alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.primary + "15", borderWidth: 0.5, borderColor: colors.primary + "33" }}>
                            <Text style={{ fontSize: 10, fontWeight: "800", color: colors.primary }}>{formatOrderId(item.id)}</Text>
                          </View>
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
                        </Pressable>
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
                          {/* Show who cancelled for cancelled orders */}
                          {item.status === "cancelled" && item.cancelledByName ? (
                            <Text style={{ fontSize: 10, color: colors.muted, fontStyle: "italic" }} numberOfLines={1}>
                              Por: {item.cancelledByName}
                            </Text>
                          ) : null}
                          {/* Cancel button */}
                          {item.status !== "cancelled" && item.status !== "completed" ? (
                            <Pressable
                              onPress={() => handleCancelRental(item.id)}
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
                    </View>
                  )}
                />
              )}
            </View>
          </ScreenContainer>
        </Modal>
      )}

      {/* Pending Company Details Inspection Modal */}
      {inspectingCompany && (
        <Modal
          visible={true}
          animationType="slide"
          onRequestClose={() => setInspectingCompany(null)}
        >
          <ScreenContainer edges={["top", "left", "right"]}>
            {/* Modal Header */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Pressable
                onPress={() => setInspectingCompany(null)}
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconSymbol name="arrow.left" size={18} color={colors.foreground} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.foreground }}>Voltar</Text>
              </Pressable>

              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>
                Empresa Solicitante
              </Text>

              <Pressable
                onPress={() => setInspectingCompany(null)}
                style={({ pressed }) => [
                  {
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <IconSymbol name="xmark" size={18} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}>
              {/* Header profile card */}
              <View style={{ alignItems: "center", gap: 10, paddingVertical: 10 }}>
                <Image
                  source={{ uri: inspectingCompany.logo || "sem-imagem" }}
                  style={{ width: 72, height: 72, borderRadius: 16, backgroundColor: colors.border }}
                  resizeMode="contain"
                />
                <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground, textAlign: "center" }}>
                  {inspectingCompany.name}
                </Text>
                <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: "#F59E0B20", borderWidth: 1, borderColor: "#F59E0B50" }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#F59E0B" }}>Aguardando Análise do Administrador</Text>
                </View>
              </View>

              {/* Section: Dados da Empresa */}
              <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.primary, marginBottom: 4 }}>
                  🏢 Dados da Empresa
                </Text>
                
                <InfoRow label="Razão Social / Nome Fantasia" value={inspectingCompany.name} />
                <InfoRow label="CNPJ" value={inspectingCompany.cnpj || "Não informado"} />
                <InfoRow label="Localização / Endereço" value={inspectingCompany.location || `${inspectingCompany.city || ""}, ${inspectingCompany.state || ""}`} />
                <InfoRow label="Descrição" value={inspectingCompany.description || "Sem descrição preenchida"} />
              </View>

              {/* Section: Dados do Responsável */}
              <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, gap: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: "800", color: colors.primary, marginBottom: 4 }}>
                  👤 Responsável pelo Cadastro
                </Text>
                
                <InfoRow label="Nome do Titular" value={inspectingCompany.ownerName || "Titular do Cadastro"} />
                <InfoRow label="E-mail de Contato" value={inspectingCompany.ownerEmail || "Não informado"} />
                <InfoRow label="Telefone / WhatsApp" value={inspectingCompany.phone || "Não informado"} />
              </View>
            </ScrollView>

            {/* Bottom Actions Footer */}
            <View
              style={{
                flexDirection: "row",
                gap: 12,
                padding: 16,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                backgroundColor: colors.surface,
              }}
            >
              <Pressable
                onPress={() => {
                  const companyId = inspectingCompany.id;
                  setInspectingCompany(null);
                  handleReject(companyId);
                }}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: "#EF444415",
                    borderWidth: 1.5,
                    borderColor: "#EF4444",
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <IconSymbol name="xmark" size={18} color="#EF4444" />
                <Text style={{ color: "#EF4444", fontWeight: "800", fontSize: 15 }}>Recusar Empresa</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  const companyId = inspectingCompany.id;
                  setInspectingCompany(null);
                  handleApprove(companyId);
                }}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 14,
                    borderRadius: 12,
                    backgroundColor: colors.success,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <IconSymbol name="checkmark" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Aprovar Empresa</Text>
              </Pressable>
            </View>
          </ScreenContainer>
        </Modal>
      )}
    </ScreenContainer>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{value}</Text>
    </View>
  );
}
