import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { FlatList, Image, Platform, Pressable, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { CartItem } from "@/lib/types";

export default function CartScreen() {
  const colors = useColors();
  const { cart, cartTotal, removeFromCart, updateCartDays, user, checkout } = useApp();

  const handleCheckout = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!user) {
      router.push({ pathname: "/auth", params: { intent: "checkout" } });
      return;
    }
    checkout();
    router.push("/orders");
  };

  return (
    <ScreenContainer className="p-4">
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 16 }}>
        Carrinho de aluguel
      </Text>

      <FlatList
        data={cart}
        keyExtractor={(item) => item.tool.id}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80, gap: 12 }}>
            <IconSymbol name="cart.fill" size={48} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 15 }}>Seu carrinho está vazio</Text>
            <Pressable
              onPress={() => router.push("/")}
              style={({ pressed }) => [
                {
                  marginTop: 6,
                  paddingHorizontal: 20,
                  paddingVertical: 11,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>Explorar ferramentas</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <CartRow item={item} onRemove={removeFromCart} onDays={updateCartDays} />
        )}
      />

      {cart.length > 0 && (
        <View style={{ gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 16, color: colors.muted }}>Total</Text>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>
              R$ {cartTotal.toFixed(2)}
            </Text>
          </View>
          <Pressable
            onPress={handleCheckout}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                borderRadius: 14,
                paddingVertical: 16,
                alignItems: "center",
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
              Finalizar aluguel
            </Text>
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  );
}

function CartRow({
  item,
  onRemove,
  onDays,
}: {
  item: CartItem;
  onRemove: (id: string) => void;
  onDays: (id: string, days: number) => void;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 10,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Image source={{ uri: item.tool.image }} style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: colors.border }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
          {item.tool.name}
        </Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>{item.companyName}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Stepper onPress={() => onDays(item.tool.id, item.days - 1)} label="−" />
            <Text style={{ color: colors.foreground, fontWeight: "700", minWidth: 56, textAlign: "center" }}>
              {item.days} {item.days > 1 ? "dias" : "dia"}
            </Text>
            <Stepper onPress={() => onDays(item.tool.id, item.days + 1)} label="+" />
          </View>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>
            R$ {(item.tool.pricePerDay * item.days).toFixed(0)}
          </Text>
        </View>
      </View>
      <Pressable onPress={() => onRemove(item.tool.id)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
        <IconSymbol name="trash" size={20} color={colors.error} />
      </Pressable>
    </View>
  );
}

function Stepper({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
