import React, { useMemo, useState } from "react";
import { FlatList, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { Rental } from "@/lib/types";
import { RentalTimer } from "@/components/rental-timer";
import { router } from "expo-router";

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
  completed: "#64748B",
  cancelled: "#6B7280",
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

      {/* Cards de Resumo */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
        style={{ flexGrow: 0 }}
      >
        <StatCard
          title="Faturamento"
          value={`R$ ${stats.faturamento.toFixed(2)}`}
          icon="cart.fill"
          color="#22C55E"
        />
        <StatCard
          title="Em Andamento"
          value={String(stats.emAndamento)}
          icon="clock.fill"
          color="#F59E0B"
        />
        <StatCard
          title="Completos"
          value={String(stats.completos)}
          icon="checkmark.circle.fill"
          color="#3B82F6"
        />
        <StatCard
          title="Cancelados"
          value={String(stats.cancelados)}
          icon="xmark.circle.fill"
          color="#EF4444"
        />
      </ScrollView>

      {/* Filtros e Busca */}
      <View style={{ gap: 12, marginBottom: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Pesquisar por ferramenta, cliente..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, color: colors.foreground, fontSize: 14, padding: 0 }}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")}>
              <IconSymbol name="xmark.circle.fill" size={16} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: "row", gap: 6 }}>
          <FilterTabButton label="Todos" active={filterStatus === "all"} onPress={() => setFilterStatus("all")} />
          <FilterTabButton label="Ativos" active={filterStatus === "in_progress"} onPress={() => setFilterStatus("in_progress")} />
          <FilterTabButton label="Concluídos" active={filterStatus === "completed"} onPress={() => setFilterStatus("completed")} />
          <FilterTabButton label="Cancelados" active={filterStatus === "cancelled"} onPress={() => setFilterStatus("cancelled")} />
        </View>
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
            onPress={() => router.push(`/order/${item.id}`)}
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
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
                  {item.toolName}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>Cliente: {item.customerName}</Text>
                <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
                  R$ {item.totalPrice.toFixed(2)} · {item.days}d
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

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  const colors = useColors();
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        minWidth: 130,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>{title}</Text>
        <IconSymbol name={icon as any} size={16} color={color} />
      </View>
      <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>{value}</Text>
    </View>
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
