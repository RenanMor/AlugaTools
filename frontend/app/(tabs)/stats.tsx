import React, { useMemo, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { Rental } from "@/lib/types";
import { RentalTimer } from "@/components/rental-timer";
import { router } from "expo-router";
import { formatOrderId, getShortOrderId } from "@/lib/utils";

const STATUS_LABEL_BACK: Record<string, string> = {
  awaiting_payment: "Aguardando pagamento",
  pending: "Aguardando entrega",
  accepted: "Entrega antecipada solicitada",
  rejected: "Recusado",
  delivering: "Em entrega",
  delivered: "Entregue (Em uso)",
  active: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_COLOR_BACK: Record<string, string> = {
  awaiting_payment: "#3B82F6",
  pending: "#F59E0B",
  accepted: "#8B5CF6",
  rejected: "#EF4444",
  delivering: "#F97316",
  delivered: "#22C55E",
  active: "#22C55E",
  completed: "#22C55E",
  cancelled: "#EF4444",
};

export default function StatsScreen() {
  const colors = useColors();
  const { user, rentals } = useApp();
  const companyId = user?.companyId;

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "in_progress" | "completed" | "cancelled">("all");

  const myRequests = useMemo(() => {
    return rentals.filter((r) => r.companyId === companyId);
  }, [rentals, companyId]);

  // Statistics calculations
  const stats = useMemo(() => {
    let cancelados = 0;
    let emAndamento = 0;
    let completos = 0;
    let faturamento = 0;

    myRequests.forEach((r) => {
      if (r.status === "cancelled" || r.status === "rejected") {
        cancelados += 1;
      } else if (r.status === "completed") {
        completos += 1;
        faturamento += r.totalPrice;
      } else {
        emAndamento += 1;
        // Include pending/delivered in potential faturamento? 
        // We only sum paid/completed for finalized faturamento, or all active ones
        if (r.status !== "awaiting_payment") {
          faturamento += r.totalPrice;
        }
      }
    });

    return { cancelados, emAndamento, completos, faturamento };
  }, [myRequests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return myRequests.filter((r) => {
      const matchesSearch =
        r.toolName.toLowerCase().includes(search.toLowerCase()) ||
        r.customerName.toLowerCase().includes(search.toLowerCase()) ||
        (r.id && r.id.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;

      if (filterStatus === "cancelled") {
        return r.status === "cancelled" || r.status === "rejected";
      }
      if (filterStatus === "completed") {
        return r.status === "completed";
      }
      if (filterStatus === "in_progress") {
        return (
          r.status !== "cancelled" &&
          r.status !== "rejected" &&
          r.status !== "completed"
        );
      }
      return true;
    });
  }, [myRequests, search, filterStatus]);

  if (!user || user.profile !== "company") {
    return (
      <ScreenContainer className="p-4">
        <View style={{ alignItems: "center", marginTop: 100, gap: 12 }}>
          <IconSymbol name="trending.up" size={48} color={colors.muted} />
          <Text style={{ color: colors.muted, textAlign: "center" }}>
            Apenas empresas podem acessar o controle de estatísticas.
          </Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="p-4" edges={["top", "left", "right"]}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 16 }}>
        Estatísticas e Controle
      </Text>

      {/* Cards de Resumo (Filtro clicável) */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <Pressable
          onPress={() => setFilterStatus(filterStatus === "all" ? "all" : "all")}
          style={({ pressed }) => [{
            flex: 1,
            minWidth: "45%",
            padding: 14,
            borderRadius: 16,
            backgroundColor: filterStatus === "all" ? "#22C55E" + "15" : colors.surface,
            borderWidth: filterStatus === "all" ? 2 : 1,
            borderColor: filterStatus === "all" ? "#22C55E" : colors.border,
            gap: 6,
            opacity: pressed ? 0.8 : 1,
          }]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: filterStatus === "all" ? "#22C55E" : colors.muted, fontWeight: "700" }}>Faturamento</Text>
            <IconSymbol name={"cart.fill" as any} size={16} color="#22C55E" />
          </View>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>
            R$ {stats.faturamento.toFixed(2)}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setFilterStatus(filterStatus === "in_progress" ? "all" : "in_progress")}
          style={({ pressed }) => [{
            flex: 1,
            minWidth: "45%",
            padding: 14,
            borderRadius: 16,
            backgroundColor: filterStatus === "in_progress" ? "#F59E0B" + "15" : colors.surface,
            borderWidth: filterStatus === "in_progress" ? 2 : 1,
            borderColor: filterStatus === "in_progress" ? "#F59E0B" : colors.border,
            gap: 6,
            opacity: pressed ? 0.8 : 1,
          }]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: filterStatus === "in_progress" ? "#F59E0B" : colors.muted, fontWeight: "700" }}>Em Andamento</Text>
            <IconSymbol name={"clock.fill" as any} size={16} color="#F59E0B" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#F59E0B" }}>{stats.emAndamento}</Text>
        </Pressable>

        <Pressable
          onPress={() => setFilterStatus(filterStatus === "completed" ? "all" : "completed")}
          style={({ pressed }) => [{
            flex: 1,
            minWidth: "45%",
            padding: 14,
            borderRadius: 16,
            backgroundColor: filterStatus === "completed" ? "#22C55E" + "15" : colors.surface,
            borderWidth: filterStatus === "completed" ? 2 : 1,
            borderColor: filterStatus === "completed" ? "#22C55E" : colors.border,
            gap: 6,
            opacity: pressed ? 0.8 : 1,
          }]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: filterStatus === "completed" ? "#22C55E" : colors.muted, fontWeight: "700" }}>Completos</Text>
            <IconSymbol name={"checkmark.circle.fill" as any} size={16} color="#22C55E" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#22C55E" }}>{stats.completos}</Text>
        </Pressable>

        <Pressable
          onPress={() => setFilterStatus(filterStatus === "cancelled" ? "all" : "cancelled")}
          style={({ pressed }) => [{
            flex: 1,
            minWidth: "45%",
            padding: 14,
            borderRadius: 16,
            backgroundColor: filterStatus === "cancelled" ? "#EF4444" + "15" : colors.surface,
            borderWidth: filterStatus === "cancelled" ? 2 : 1,
            borderColor: filterStatus === "cancelled" ? "#EF4444" : colors.border,
            gap: 6,
            opacity: pressed ? 0.8 : 1,
          }]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 12, color: filterStatus === "cancelled" ? "#EF4444" : colors.muted, fontWeight: "700" }}>Cancelados</Text>
            <IconSymbol name={"xmark.circle.fill" as any} size={16} color="#EF4444" />
          </View>
          <Text style={{ fontSize: 20, fontWeight: "800", color: "#EF4444" }}>{stats.cancelados}</Text>
        </Pressable>
      </View>

      {/* Lista de Pedidos */}
      <FlatList
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Text style={{ color: colors.muted }}>Nenhum pedido encontrado.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/order/${getShortOrderId(item.id)}`)}
            style={({ pressed }) => [
              {
                padding: 12,
                borderRadius: 14,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 8,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Image source={{ uri: item.toolImage }} style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: colors.border }} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.primary + "15", borderWidth: 0.5, borderColor: colors.primary + "33" }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: colors.primary }}>{formatOrderId(item.id)}</Text>
                </View>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
                  {item.toolName}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>Cliente: {item.customerName}</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.success }}>
                  {item.days}d · R$ {item.totalPrice.toFixed(2)}
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 8,
                  backgroundColor: (STATUS_COLOR_BACK[item.status] || colors.muted) + "15",
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "700", color: STATUS_COLOR_BACK[item.status] || colors.muted }}>
                  {STATUS_LABEL_BACK[item.status] || item.status}
                </Text>
              </View>
            </View>

            {item.deliveredAt && (item.status === "delivered" || item.status === "active" || item.status === "accepted") && (
              <View style={{ borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600" }}>Restante:</Text>
                <RentalTimer deliveredAt={item.deliveredAt} days={item.days} />
              </View>
            )}
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}


function FilterTabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: active ? colors.primary + "15" : colors.surface,
        borderWidth: 1,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", color: active ? colors.primary : colors.foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}
