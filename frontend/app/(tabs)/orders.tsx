import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Image, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { Rental, RentalStatus } from "@/lib/types";
import { RentalTimer } from "@/components/rental-timer";
import { spacing, fontSize, fontWeight, pageTitle } from "@/lib/design-tokens";
import { formatOrderId } from "@/lib/utils";

const STATUS_LABEL: Record<RentalStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  pending: "Aguardando entrega",
  accepted: "Entrega solicitada",
  rejected: "Recusado",
  delivering: "Em rota de entrega",
  delivered: "Entregue (Em uso)",
  active: "Em uso",
  completed: "Concluído",
  cancelled: "Cancelado",
  return_expired: "Tempo expirado, entregador a caminho",
};

const STATUS_VARIANT: Record<RentalStatus, "info" | "warning" | "primary" | "error" | "success" | "muted"> = {
  awaiting_payment: "info",
  pending: "warning",
  accepted: "primary",
  rejected: "error",
  delivering: "primary",
  delivered: "success",
  active: "success",
  completed: "muted",
  cancelled: "muted",
  return_expired: "error",
};

export default function OrdersScreen() {
  const colors = useColors();
  const { rentals, user } = useApp();
  const isDeliverer = user?.profile === "deliverer";
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRentals = useMemo(() => {
    if (!searchQuery.trim()) return rentals;
    const q = searchQuery.trim().toLowerCase().replace(/^pedido#/i, "");
    return rentals.filter((r) => {
      const formattedId = formatOrderId(r.id).toLowerCase();
      const rawId = r.id.toLowerCase();
      const toolName = (r.toolName || "").toLowerCase();
      const companyName = (r.companyName || "").toLowerCase();
      const customerName = (r.customerName || "").toLowerCase();
      return (
        formattedId.includes(q) ||
        rawId.includes(q) ||
        toolName.includes(q) ||
        companyName.includes(q) ||
        customerName.includes(q)
      );
    });
  }, [rentals, searchQuery]);

  return (
    <ScreenContainer className="p-4">
      <Text style={[pageTitle(colors), { marginBottom: spacing.sm }]}>
        {isDeliverer ? "Entregas da Empresa" : "Meus pedidos"}
      </Text>

      {!user ? (
        <EmptyState
          icon="list.bullet"
          title="Faça login para ver seus pedidos"
          description="Navegue livremente. O login só é necessário ao alugar."
          actionLabel="Entrar"
          onAction={() => router.push("/auth")}
        />
      ) : (
        <>
          {/* Search bar for Deliverers / Users to search orders by ID or name */}
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
              marginBottom: spacing.md,
              gap: 8,
            }}
          >
            <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={isDeliverer ? "Buscar pedido por ID (Ex: Pedido#466B66C9)..." : "Buscar pedidos por ID ou nome..."}
              placeholderTextColor={colors.muted}
              style={{
                flex: 1,
                fontSize: 14,
                color: colors.foreground,
                padding: 0,
              }}
            />
            {searchQuery.length > 0 && (
              <IconSymbol
                name="xmark"
                size={16}
                color={colors.muted}
                onPress={() => setSearchQuery("")}
              />
            )}
          </View>

          <FlatList
            data={filteredRentals}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
            contentContainerStyle={{ paddingBottom: spacing.xxl }}
            ListEmptyComponent={
              <EmptyState
                icon={isDeliverer ? "truck.box.fill" : "list.bullet"}
                title={searchQuery ? "Nenhum pedido encontrado" : isDeliverer ? "Nenhuma entrega registrada" : "Nenhum pedido ainda"}
                description={
                  searchQuery
                    ? `Nenhum pedido corresponde à busca "${searchQuery}".`
                    : isDeliverer
                    ? "Os pedidos da empresa aparecerão aqui."
                    : "Explore ferramentas e faça seu primeiro aluguel."
                }
              />
            }
            renderItem={({ item }) => <OrderCard rental={item} />}
          />
        </>
      )}
    </ScreenContainer>
  );
}

function OrderCard({ rental }: { rental: Rental }) {
  const colors = useColors();
  const variant = STATUS_VARIANT[rental.status] || "muted";

  return (
    <Card
      onPress={() => router.push(`/order/${rental.id}`)}
      style={{ padding: spacing.md, gap: spacing.md }}
    >
      {/* Header row: Order ID Badge + Status Badge */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.primary + "15", borderWidth: 0.5, borderColor: colors.primary + "33" }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: colors.primary }}>
            {formatOrderId(rental.id)}
          </Text>
        </View>
        <Badge variant={variant} size="sm">
          {STATUS_LABEL[rental.status] || rental.status}
        </Badge>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Image
          source={{ uri: rental.toolImage }}
          style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.border }}
        />
        <View style={{ flex: 1, gap: 4, justifyContent: "center" }}>
          <Text numberOfLines={1} style={{ fontSize: fontSize.md + 1, fontWeight: fontWeight.bold, color: colors.foreground }}>
            {rental.toolName}
          </Text>
          <Text style={{ fontSize: fontSize.sm, color: colors.muted }}>{rental.companyName}</Text>
          <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.success }}>
            R$ {rental.totalPrice.toFixed(2)} · {rental.days}d
          </Text>
        </View>
        <View style={{ justifyContent: "center", alignItems: "flex-end" }}>
          <IconSymbol name="chevron.right" size={18} color={colors.muted} />
        </View>
      </View>

      {rental.deliveredAt && (rental.status === "delivered" || rental.status === "active" || rental.status === "accepted") && (
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: spacing.sm, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: fontSize.sm, color: colors.muted, fontWeight: fontWeight.semibold }}>Tempo Restante:</Text>
          <RentalTimer deliveredAt={rental.deliveredAt} days={rental.days} />
        </View>
      )}
    </Card>
  );
}
