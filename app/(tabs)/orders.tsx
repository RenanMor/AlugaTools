import { router } from "expo-router";
import { FlatList, Image, Pressable, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StarRating } from "@/components/star-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { Rental, RentalStatus } from "@/lib/types";

const STATUS_LABEL: Record<RentalStatus, string> = {
  pending: "Aguardando empresa",
  accepted: "Aceito",
  rejected: "Recusado",
  active: "Em andamento",
  completed: "Concluído",
};

const STATUS_COLOR: Record<RentalStatus, string> = {
  pending: "#F59E0B",
  accepted: "#3B82F6",
  rejected: "#EF4444",
  active: "#22C55E",
  completed: "#64748B",
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
            <OrderCard
              rental={item}
              onRate={(v) => rateRental(item.id, v)}
              onComplete={() => setRentalStatus(item.id, "completed")}
            />
          )}
        />
      )}
    </ScreenContainer>
  );
}

function OrderCard({
  rental,
  onRate,
  onComplete,
}: {
  rental: Rental;
  onRate: (v: number) => void;
  onComplete: () => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Image source={{ uri: rental.toolImage }} style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: colors.border }} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
            {rental.toolName}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>{rental.companyName}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
            R$ {rental.totalPrice.toFixed(2)} · {rental.days} {rental.days > 1 ? "dias" : "dia"}
          </Text>
        </View>
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 20,
            backgroundColor: STATUS_COLOR[rental.status] + "22",
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: STATUS_COLOR[rental.status] }}>
            {STATUS_LABEL[rental.status]}
          </Text>
        </View>
      </View>

      {rental.status === "active" && (
        <Pressable
          onPress={onComplete}
          style={({ pressed }) => [
            { backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: "center", opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Marcar como concluído</Text>
        </Pressable>
      )}

      {rental.status === "completed" && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 6 }}>
          <Text style={{ fontSize: 13, color: colors.muted }}>
            {rental.rating ? "Sua avaliação" : "Avalie este serviço"}
          </Text>
          <StarRating value={rental.rating ?? 0} size={24} editable={!rental.rating} onChange={onRate} />
        </View>
      )}
    </View>
  );
}
