import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { FlatList, Image, Platform, Pressable, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { CartItem } from "@/lib/types";

export default function CartScreen() {
  const colors = useColors();
  const { cart, cartTotal, removeFromCart, updateCartDays, updateCartQuantity, user, checkout } = useApp();

  useEffect(() => {
    if (user?.profile === "deliverer") {
      router.replace("/orders");
    }
  }, [user]);

  const handleCheckout = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!user) {
      router.push({ pathname: "/auth", params: { intent: "checkout" } });
      return;
    }
    router.push("/checkout");
  };

  return (
    <ScreenContainer className="p-4">
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 16 }}>
        Carrinho de aluguel
      </Text>

      <FlatList
        data={cart}
        keyExtractor={(item) => item.id || item.tool.id}
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
          <CartRow
            item={item}
            onRemove={removeFromCart}
            onDays={updateCartDays}
            onQuantity={updateCartQuantity}
          />
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
  onQuantity,
}: {
  item: CartItem;
  onRemove: (id: string) => void;
  onDays: (id: string, days: number) => void;
  onQuantity: (id: string, quantity: number) => void;
}) {
  const colors = useColors();
  const minD = item.tool.minDays || 1;
  const maxD = item.tool.maxDays || 30;
  const maxQty = item.tool.quantity || 1;
  const currentDays = item.days;
  const currentQty = item.quantity || 1;

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
      <View style={{ flex: 1, gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
              {item.tool.name}
            </Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>{item.companyName}</Text>
          </View>
          <Pressable onPress={() => onRemove(item.id)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <IconSymbol name="trash" size={20} color={colors.error} />
          </Pressable>
        </View>

        <View style={{ gap: 6 }}>
          {/* Renting Days Stepper */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Tempo aluguel:{" "}
              <Text style={{ fontSize: 11, color: colors.muted }}>({minD}–{maxD} dias)</Text>
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Stepper
                onPress={() => onDays(item.id, currentDays - 1)}
                label="−"
                disabled={currentDays <= minD}
              />
              <Text style={{ color: colors.foreground, fontWeight: "700", minWidth: 50, textAlign: "center", fontSize: 13 }}>
                {currentDays} {currentDays > 1 ? "dias" : "dia"}
              </Text>
              <Stepper
                onPress={() => onDays(item.id, currentDays + 1)}
                label="+"
                disabled={currentDays >= maxD}
              />
            </View>
          </View>

          {/* Item Quantity Stepper */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12, color: colors.muted }}>
              Quant. itens:{" "}
              <Text style={{ fontSize: 11, color: colors.muted }}>(máx. {maxQty})</Text>
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Stepper
                onPress={() => onQuantity(item.id, currentQty - 1)}
                label="−"
                disabled={currentQty <= 1}
              />
              <Text style={{ color: colors.foreground, fontWeight: "700", minWidth: 50, textAlign: "center", fontSize: 13 }}>
                {currentQty} un.
              </Text>
              <Stepper
                onPress={() => onQuantity(item.id, currentQty + 1)}
                label="+"
                disabled={currentQty >= maxQty}
              />
            </View>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 2 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>Subtotal:</Text>
          <Text style={{ fontSize: 15, fontWeight: "800", color: colors.primary }}>
            R$ {((item.tool.pricePerDay * currentDays) * currentQty).toFixed(2)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Stepper({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          width: 28,
          height: 28,
          borderRadius: 8,
          backgroundColor: disabled ? colors.border : colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text style={{ color: disabled ? colors.muted : colors.foreground, fontSize: 18, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}
