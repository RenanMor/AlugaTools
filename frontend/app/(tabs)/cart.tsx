import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { FlatList, Image, Platform, Pressable, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { CartItem } from "@/lib/types";
import { spacing, fontSize, fontWeight, radius, pageTitle } from "@/lib/design-tokens";

export default function CartScreen() {
  const colors = useColors();
  const { cart, cartTotal, removeFromCart, updateCartDays, updateCartQuantity, user, checkout, companies } = useApp();

  useEffect(() => {
    if (user?.profile === "deliverer") {
      router.replace("/orders");
    }
  }, [user]);

  const handleCheckout = async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const closedItems = cart.filter((item) => {
      const comp = companies.find((c) => c.id === item.tool.companyId);
      return comp ? comp.isOpen === false : false;
    });

    if (closedItems.length > 0) {
      const closedStoreNames = Array.from(new Set(closedItems.map((item) => item.companyName))).join(", ");
      alert(`Não é possível finalizar o aluguel. A(s) seguinte(s) loja(s) está(ão) fechada(s): ${closedStoreNames}`);
      return;
    }

    if (!user) {
      router.push({ pathname: "/auth", params: { intent: "checkout" } });
      return;
    }
    router.push("/checkout");
  };

  return (
    <ScreenContainer className="p-4">
      <Text style={[pageTitle(colors), { marginBottom: spacing.lg }]}>
        Carrinho de aluguel
      </Text>

      <FlatList
        data={cart}
        keyExtractor={(item) => item.id || item.tool.id}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        contentContainerStyle={{ paddingBottom: spacing.lg, flexGrow: 1 }}
        ListEmptyComponent={
          <EmptyState
            icon="cart.fill"
            title="Seu carrinho está vazio"
            description="Explore empresas e ferramentas para começar a alugar."
            actionLabel="Explorar ferramentas"
            onAction={() => router.push("/")}
          />
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
        <View style={{ gap: spacing.md, paddingTop: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: fontSize.lg, color: colors.muted }}>Total</Text>
            <Text style={{ fontSize: 22, fontWeight: fontWeight.black, color: colors.foreground }}>
              R$ {cartTotal.toFixed(2)}
            </Text>
          </View>
          <Button onPress={handleCheckout} size="lg">
            Finalizar aluguel
          </Button>
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
    <Card style={{ padding: spacing.sm + 2 }}>
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Image source={{ uri: item.tool.image }} style={{ width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.border }} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text numberOfLines={1} style={{ fontSize: fontSize.md + 1, fontWeight: fontWeight.bold, color: colors.foreground }}>
                {item.tool.name}
              </Text>
              <Text style={{ fontSize: fontSize.sm, color: colors.muted }}>{item.companyName}</Text>
            </View>
            <Pressable onPress={() => onRemove(item.id)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
              <IconSymbol name="trash" size={20} color={colors.error} />
            </Pressable>
          </View>

          <View style={{ gap: 6 }}>
            {/* Days stepper */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.muted }}>
                Dias: <Text style={{ fontSize: fontSize.xs }}>{minD}–{maxD}</Text>
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Stepper onPress={() => onDays(item.id, currentDays - 1)} label="−" disabled={currentDays <= minD} />
                <Text style={{ color: colors.foreground, fontWeight: fontWeight.bold, minWidth: 50, textAlign: "center", fontSize: fontSize.sm }}>
                  {currentDays} {currentDays > 1 ? "dias" : "dia"}
                </Text>
                <Stepper onPress={() => onDays(item.id, currentDays + 1)} label="+" disabled={currentDays >= maxD} />
              </View>
            </View>

            {/* Qty stepper */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: fontSize.sm, color: colors.muted }}>
                Qtd: <Text style={{ fontSize: fontSize.xs }}>máx. {maxQty}</Text>
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <Stepper onPress={() => onQuantity(item.id, currentQty - 1)} label="−" disabled={currentQty <= 1} />
                <Text style={{ color: colors.foreground, fontWeight: fontWeight.bold, minWidth: 50, textAlign: "center", fontSize: fontSize.sm }}>
                  {currentQty} un.
                </Text>
                <Stepper onPress={() => onQuantity(item.id, currentQty + 1)} label="+" disabled={currentQty >= maxQty} />
              </View>
            </View>
          </View>

          <View style={{ height: 0.5, backgroundColor: colors.border, marginVertical: 2 }} />

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: fontSize.sm, color: colors.muted }}>Subtotal:</Text>
            <Text style={{ fontSize: fontSize.md + 1, fontWeight: fontWeight.black, color: colors.primary }}>
              R$ {((item.tool.pricePerDay * currentDays) * currentQty).toFixed(2)}
            </Text>
          </View>
        </View>
      </View>
    </Card>
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
          borderRadius: radius.sm,
          backgroundColor: disabled ? colors.border : colors.background,
          borderWidth: 0.5,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
          transform: [{ scale: pressed && !disabled ? 0.92 : 1 }],
        },
      ]}
    >
      <Text style={{ color: disabled ? colors.muted : colors.foreground, fontSize: 18, fontWeight: fontWeight.bold }}>{label}</Text>
    </Pressable>
  );
}
