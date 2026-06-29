import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StarRating } from "@/components/star-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { Rental, RentalStatus } from "@/lib/types";
import { cancelRental } from "@/lib/api/rentals";

const STATUS_LABEL: Record<RentalStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  pending: "Aguardando empresa",
  accepted: "Aceito",
  rejected: "Recusado",
  active: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_COLOR: Record<RentalStatus, string> = {
  awaiting_payment: "#3B82F6",
  pending: "#F59E0B",
  accepted: "#3B82F6",
  rejected: "#EF4444",
  active: "#22C55E",
  completed: "#64748B",
  cancelled: "#6B7280",
};

export default function OrdersScreen() {
  const colors = useColors();
  const { rentals, user, rateRental, setRentalStatus } = useApp();

  return (
    <ScreenContainer className="p-4">
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 16 }}>
        Meus pedidos
      </Text>

      {!user ? (
        <View style={{ alignItems: "center", marginTop: 80, gap: 12 }}>
          <IconSymbol name="list.bullet" size={48} color={colors.muted} />
          <Text style={{ color: colors.muted }}>Entre para ver seus pedidos</Text>
          <Pressable
            onPress={() => router.push("/auth")}
            style={({ pressed }) => [
              { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Entrar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rentals}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={{ color: colors.muted, textAlign: "center", marginTop: 60 }}>
              Você ainda não fez nenhum aluguel.
            </Text>
          }
          renderItem={({ item }) => (
            <OrderCard rental={item} />
          )}
        />
      )}
    </ScreenContainer>
  );
}

function OrderCard({ rental }: { rental: Rental }) {
  const colors = useColors();

  return (
    <Pressable
      onPress={() => router.push(`/order/${rental.id}`)}
      style={({ pressed }) => [
        {
          padding: 12,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: "row",
          gap: 12,
          opacity: pressed ? 0.7 : 1,
        }
      ]}
    >
      <Image source={{ uri: rental.toolImage }} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.border }} />
      <View style={{ flex: 1, gap: 4, justifyContent: "center" }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
          {rental.toolName}
        </Text>
        <Text style={{ fontSize: 13, color: colors.muted }}>{rental.companyName}</Text>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>
          R$ {rental.totalPrice.toFixed(2)}
        </Text>
      </View>
      <View style={{ justifyContent: "center", alignItems: "flex-end" }}>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 20,
            backgroundColor: STATUS_COLOR[rental.status] + "22",
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: STATUS_COLOR[rental.status] }}>
            {STATUS_LABEL[rental.status]}
          </Text>
        </View>
        <IconSymbol name="chevron.right" size={20} color={colors.muted} style={{ marginTop: 8 }} />
      </View>
    </Pressable>
  );
}
