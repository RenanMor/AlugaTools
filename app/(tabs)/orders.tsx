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
  const { refreshRentals, refreshCatalog } = useApp();
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isCancelling, setIsCancelling] = useState(false);

  // Time remaining calculation (30 minutes from creation)
  const expiryTime = useMemo(() => rental.createdAt + 30 * 60 * 1000, [rental.createdAt]);

  useEffect(() => {
    if (rental.status !== "awaiting_payment") return;

    const updateTimer = () => {
      const diff = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
      setTimeLeft(diff);

      if (diff <= 0) {
        clearInterval(interval);
        handleAutoCancel();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [rental.status, expiryTime]);

  const handleAutoCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelRental(rental.id);
      await Promise.all([refreshRentals(), refreshCatalog()]);
    } catch (err) {
      console.warn("Failed to auto-cancel rental:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleManualCancel = () => {
    Alert.alert("Cancelar Aluguel", "Tem certeza que deseja cancelar esta reserva?", [
      { text: "Não", style: "cancel" },
      {
        text: "Sim, Cancelar",
        style: "destructive",
        onPress: async () => {
          setIsCancelling(true);
          try {
            await cancelRental(rental.id);
            await Promise.all([refreshRentals(), refreshCatalog()]);
            Alert.alert("Sucesso", "Reserva cancelada com sucesso!");
          } catch (err: any) {
            Alert.alert("Erro", err.message || "Falha ao cancelar reserva.");
          } finally {
            setIsCancelling(false);
          }
        },
      },
    ]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Extract PagBank PIX code
  const pixCode = useMemo(() => {
    if (rental.paymentMethod !== "PIX") return null;
    const charge = rental.paymentData?.charges?.[0];
    return (
      charge?.payment_method?.pix?.qrcode?.text ||
      rental.paymentData?.qr_codes?.[0]?.text ||
      null
    );
  }, [rental]);

  // Extract PagBank Boleto barcode & booklet URL
  const boletoInfo = useMemo(() => {
    if (rental.paymentMethod !== "BOLETO") return null;
    const charge = rental.paymentData?.charges?.[0];
    const barcode = charge?.payment_method?.boleto?.barcode || null;
    const bookletUrl = charge?.links?.find((l: any) => l.rel === "pay" || l.media === "application/pdf")?.href || null;
    return { barcode, bookletUrl };
  }, [rental]);

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

      {/* Awaiting payment section with timer */}
      {rental.status === "awaiting_payment" && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <IconSymbol name="clock" size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>
                Pague em até {formatTime(timeLeft)}
              </Text>
            </View>
            <Pressable onPress={handleManualCancel} disabled={isCancelling} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
              {isCancelling ? (
                <ActivityIndicator size="small" color={colors.error} />
              ) : (
                <Text style={{ fontSize: 13, color: colors.error, fontWeight: "700" }}>Cancelar</Text>
              )}
            </Pressable>
          </View>

          {/* PIX Payment Instructions */}
          {rental.paymentMethod === "PIX" && pixCode && (
            <View style={{ padding: 10, borderRadius: 10, backgroundColor: colors.background, gap: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>Chave Copia e Cola PIX:</Text>
              <TextInput
                value={pixCode}
                editable={false}
                selectTextOnFocus
                style={{
                  fontSize: 11,
                  fontFamily: Platform.OS === "web" ? "monospace" : undefined,
                  color: colors.muted,
                  backgroundColor: colors.surface,
                  padding: 8,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              />
              <Text style={{ fontSize: 11, color: colors.muted }}>Toque acima para selecionar e copiar o código de pagamento.</Text>
            </View>
          )}

          {/* BOLETO Payment Instructions */}
          {rental.paymentMethod === "BOLETO" && boletoInfo && (
            <View style={{ padding: 10, borderRadius: 10, backgroundColor: colors.background, gap: 8 }}>
              {boletoInfo.barcode && (
                <>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.foreground }}>Código de Barras:</Text>
                  <TextInput
                    value={boletoInfo.barcode}
                    editable={false}
                    selectTextOnFocus
                    style={{
                      fontSize: 11,
                      fontFamily: Platform.OS === "web" ? "monospace" : undefined,
                      color: colors.muted,
                      backgroundColor: colors.surface,
                      padding: 8,
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  />
                </>
              )}
              {boletoInfo.bookletUrl && (
                <Pressable
                  onPress={() => Linking.openURL(boletoInfo.bookletUrl!)}
                  style={({ pressed }) => [
                    {
                      backgroundColor: colors.primary,
                      borderRadius: 8,
                      paddingVertical: 10,
                      alignItems: "center",
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Visualizar Boleto (PDF)</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}

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
