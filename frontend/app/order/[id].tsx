import { useLocalSearchParams, router } from "expo-router";
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Modal,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StarRating } from "@/components/star-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { Rental, RentalStatus } from "@/lib/types";
import { cancelRental, getRentalById, payRental } from "@/lib/api/rentals";
import { cancelCompanyRental } from "@/lib/api/admin";
import { RentalTimer } from "@/components/rental-timer";
import { formatOrderId } from "@/lib/utils";

const STATUS_LABEL: Record<RentalStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  pending: "Aguardando entrega",
  accepted: "Entrega antecipada solicitada",
  rejected: "Recusado",
  delivering: "Em rota de entrega",
  delivered: "Entregue",
  active: "Em uso",
  completed: "Concluído",
  cancelled: "Cancelado",
  return_expired: "Tempo expirado, entregador a caminho",
};

const STATUS_COLOR: Record<RentalStatus, string> = {
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

export default function OrderDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const { refreshRentals, refreshCatalog, rateRental, setRentalStatus, user } = useApp();

  const [rental, setRental] = useState<Rental | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const [selectedRating, setSelectedRating] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState<string>("");
  const [isSubmittingRating, setIsSubmittingRating] = useState<boolean>(false);

  const [showReceiverModal, setShowReceiverModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showStartDeliveryModal, setShowStartDeliveryModal] = useState(false);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);
  const [photoSourceIndex, setPhotoSourceIndex] = useState<number | null>(null);
  const [deliveryPhotos, setDeliveryPhotos] = useState<string[]>(["", "", ""]);
  const [receiverName, setReceiverName] = useState("");
  const [receiverCpf, setReceiverCpf] = useState("");

  // Retry payment state
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCardNumber, setRetryCardNumber] = useState("");
  const [retryCardHolder, setRetryCardHolder] = useState("");
  const [retryCardExpiry, setRetryCardExpiry] = useState("");
  const [retryCardCvv, setRetryCardCvv] = useState("");
  const [retryInstallments, setRetryInstallments] = useState("1");

  // Payment loading modal state
  const [paymentLoadingVisible, setPaymentLoadingVisible] = useState(false);
  const [paymentLoadingStatus, setPaymentLoadingStatus] = useState<"processing" | "success" | "failed">("processing");
  // Rotation animation for loading spinner
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (paymentLoadingVisible && paymentLoadingStatus === "processing") {
      spinAnim.setValue(0);
      animation = Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: Platform.OS !== "web",
          isInteraction: false,
        })
      );
      animation.start();
    } else {
      spinAnim.stopAnimation();
      spinAnim.setValue(0);
    }
    return () => {
      animation?.stop();
    };
  }, [paymentLoadingVisible, paymentLoadingStatus]);

  const isDeliverer = user?.profile === "deliverer";
  const isCompany = !!rental && user?.profile === "company" && user?.companyId === rental.companyId;
  const isOwner = !!user?.isOwner;
  const isPickup = !!rental && (!rental.address || rental.shippingPrice === 0 || !rental.address.street);
  const canManageDelivery = isDeliverer || isCompany || isOwner;

  const orderCustomerCpf = rental?.customerCpf || (user?.cpf ? user.cpf : "");
  const targetDeliveryCode = useMemo(() => {
    if (!orderCustomerCpf) return "";
    const digits = orderCustomerCpf.replace(/\D/g, "");
    return digits.length >= 4 ? digits.slice(-4) : digits;
  }, [orderCustomerCpf]);

  const isDeliveryCodeValid = useMemo(() => {
    const digits = receiverCpf.replace(/\D/g, "");
    if (digits.length !== 4) return false;
    if (!targetDeliveryCode) return true;
    return digits === targetDeliveryCode;
  }, [receiverCpf, targetDeliveryCode]);

  // CPF validation helper: checks digit verification algorithm (for return confirmation modal)
  const isCpfValid = useMemo(() => {
    const digits = receiverCpf.replace(/\D/g, "");
    if (digits.length !== 11) return false;
    // Reject all same digits
    if (/^(\d)\1{10}$/.test(digits)) return false;
    // Verify check digits
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
    let rem = (sum * 10) % 11;
    if (rem === 10) rem = 0;
    if (rem !== parseInt(digits[9])) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
    rem = (sum * 10) % 11;
    if (rem === 10) rem = 0;
    return rem === parseInt(digits[10]);
  }, [receiverCpf]);

  const fetchOrder = async () => {
    try {
      const data = await getRentalById(id as string);
      setRental(data);
    } catch (err: any) {
      Alert.alert("Acesso Negado", "Você não tem permissão para visualizar este pedido ou ele não foi encontrado.");
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time polling: refresh order data every 3 seconds to update status & layout
  useEffect(() => {
    if (!id) return;
    fetchOrder();

    const interval = setInterval(() => {
      getRentalById(id as string)
        .then((updatedData) => {
          if (updatedData) setRental(updatedData);
        })
        .catch(() => { });
    }, 3000);

    return () => clearInterval(interval);
  }, [id]);

  // Timer logic
  const expiryTime = useMemo(() => rental ? rental.createdAt + 30 * 60 * 1000 : 0, [rental]);

  useEffect(() => {
    if (!rental || rental.status !== "awaiting_payment") return;

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
  }, [rental?.status, expiryTime]);

  const handleAutoCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelRental(rental!.id);
      await Promise.all([refreshRentals(), refreshCatalog()]);
      await fetchOrder();
    } catch (err) {
      console.warn("Failed to auto-cancel rental:", err);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleManualCancel = () => {
    const doCancel = async () => {
      setIsCancelling(true);
      try {
        if (isOwner && rental) {
          await cancelCompanyRental(rental.companyId, rental.id);
        } else {
          await cancelRental(rental!.id);
        }
        await Promise.all([refreshRentals(), refreshCatalog()]);
        await fetchOrder();
        if (Platform.OS === "web") {
          window.alert("Reserva cancelada com sucesso!");
        } else {
          Alert.alert("Sucesso", "Reserva cancelada com sucesso!");
        }
      } catch (err: any) {
        if (Platform.OS === "web") {
          window.alert(err.message || "Falha ao cancelar reserva.");
        } else {
          Alert.alert("Erro", err.message || "Falha ao cancelar reserva.");
        }
      } finally {
        setIsCancelling(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Cancelar Aluguel\n\nTem certeza que deseja cancelar esta reserva?")) {
        doCancel();
      }
    } else {
      Alert.alert("Cancelar Aluguel", "Tem certeza que deseja cancelar esta reserva?", [
        { text: "Não", style: "cancel" },
        {
          text: "Sim, Cancelar",
          style: "destructive",
          onPress: doCancel,
        },
      ]);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(mins)}:${pad(secs)}`;
  };

  const pixCode = useMemo(() => {
    if (!rental || rental.paymentMethod !== "PIX") return null;
    const charge = rental.paymentData?.charges?.[0];
    return charge?.payment_method?.pix?.qrcode?.text || rental.paymentData?.qr_codes?.[0]?.text || null;
  }, [rental]);

  const boletoInfo = useMemo(() => {
    if (!rental || rental.paymentMethod !== "BOLETO") return null;
    const charge = rental.paymentData?.charges?.[0];
    const barcode = charge?.payment_method?.boleto?.barcode || null;
    const bookletUrl = charge?.links?.find((l: any) => l.rel === "pay" || l.media === "application/pdf")?.href || null;
    return { barcode, bookletUrl };
  }, [rental]);

  const handleUpdateStatus = async (status: RentalStatus, rName?: string, rCpf?: string, dPhotos?: string[]) => {
    if (isStatusLoading) return;
    setIsStatusLoading(true);
    try {
      await setRentalStatus(rental!.id, status, rName, rCpf, dPhotos);
      await fetchOrder();
    } catch (err: any) {
      Alert.alert("Erro", err.message || "Não foi possível atualizar o status.");
    } finally {
      setIsStatusLoading(false);
    }
  };

  const handleUploadDeliveryPhoto = (index: number) => {
    setPhotoSourceIndex(index);
    triggerImageUpload(index, "camera");
  };

  const compressImage = (dataUrl: string, maxWidth = 1000, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !dataUrl.startsWith("data:image")) {
        return resolve(dataUrl);
      }
      const img = document.createElement("img");
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxWidth) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxWidth) / height);
            height = maxWidth;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const triggerImageUpload = (index: number, mode: "camera" | "gallery" = "camera") => {
    if (Platform.OS === "web") {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      if (mode === "camera") {
        input.setAttribute("capture", "environment");
      }
      input.onchange = (e: any) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async () => {
            const raw = reader.result as string;
            const compressed = await compressImage(raw, 1000, 0.7);
            setDeliveryPhotos((prev: string[]) => {
              const next = [...prev];
              next[index] = compressed;
              return next;
            });
          };
          reader.readAsDataURL(file);
        }
      };
      input.click();
    } else {
      const url = prompt(`Cole a URL da foto ${index + 1}:`);
      if (url) {
        setDeliveryPhotos((prev: string[]) => {
          const next = [...prev];
          next[index] = url;
          return next;
        });
      }
    }
  };

  const openStartDeliveryModal = () => {
    setDeliveryPhotos(["", "", ""]);
    setShowStartDeliveryModal(true);
  };

  const handleConfirmStartDelivery = async () => {
    const validPhotos = deliveryPhotos.filter(Boolean);
    setShowStartDeliveryModal(false);
    await handleUpdateStatus("delivering", undefined, undefined, validPhotos);
  };

  const handleRetryPayment = async () => {
    if (!rental || isRetrying) return;
    setIsRetrying(true);
    setPaymentLoadingStatus("processing");
    setPaymentLoadingVisible(true);
    try {
      let cardPayload: any = undefined;
      const method = rental.paymentMethod || "";

      if (method === "CREDIT_CARD" || method === "DEBIT_CARD") {
        if (!retryCardNumber || !retryCardHolder || !retryCardExpiry || !retryCardCvv) {
          setPaymentLoadingVisible(false);
          Alert.alert("Erro", "Por favor, preencha todos os dados do cartão.");
          setIsRetrying(false);
          return;
        }
        const expParts = retryCardExpiry.split("/");
        cardPayload = {
          number: retryCardNumber.replace(/\D/g, ""),
          exp_month: expParts[0] || "12",
          exp_year: expParts[1] ? (expParts[1].length === 2 ? "20" + expParts[1] : expParts[1]) : "2027",
          security_code: retryCardCvv,
          holder: { name: retryCardHolder },
        };
      }

      await payRental(rental.id, {
        card: cardPayload,
        installments: method === "CREDIT_CARD" ? Number(retryInstallments) || 1 : undefined,
      });

      await Promise.all([refreshRentals(), refreshCatalog()]);
      setPaymentLoadingStatus("success");
      setTimeout(async () => {
        setPaymentLoadingVisible(false);
        setShowRetryModal(false);
        await fetchOrder();
      }, 1800);
    } catch (err: any) {
      setPaymentLoadingStatus("failed");
      await new Promise<void>((resolve) => setTimeout(resolve, 900));
      setPaymentLoadingVisible(false);
      Alert.alert(
        "Pagamento Recusado",
        "Seu pagamento foi recusado. Tente com outro método de pagamento.",
        [{ text: "Tentar Novamente", style: "cancel" }]
      );
    } finally {
      setIsRetrying(false);
    }
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (!rental) return null;

  return (
    <ScreenContainer edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground }}>Detalhes do Pedido</Text>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primary + "15", borderWidth: 0.5, borderColor: colors.primary + "33" }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: colors.primary }}>{formatOrderId(rental.id)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} showsVerticalScrollIndicator={false}>

        {/* Header (Status) */}
        <View style={{ padding: 16, borderRadius: 14, backgroundColor: STATUS_COLOR[rental.status] + "11", borderWidth: 1, borderColor: STATUS_COLOR[rental.status] + "44", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>Status do Pedido</Text>
          <Text style={{ fontSize: 20, fontWeight: "800", color: STATUS_COLOR[rental.status] }}>
            {STATUS_LABEL[rental.status]}
          </Text>
          {rental.status === "delivering" && targetDeliveryCode ? (
            <View style={{ marginTop: 2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#F973161F", borderWidth: 1, borderColor: "#F9731644", alignItems: "center" }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#F97316", textAlign: "center" }}>
                conferir pedido e informar código: {targetDeliveryCode}
              </Text>
            </View>
          ) : null}
          <Text style={{ fontSize: 12, color: colors.muted }}>
            Realizado em: {new Date(rental.createdAt).toLocaleString("pt-BR")}
          </Text>
          {rental.status === "cancelled" && rental.cancelledByName ? (
            <Text style={{ fontSize: 12, color: colors.muted, fontStyle: "italic" }}>
              Cancelado por: {rental.cancelledByName}
            </Text>
          ) : null}
        </View>

        {/* Timer de uso do aluguel */}
        {rental.deliveredAt && (rental.status === "delivered" || rental.status === "active" || rental.status === "accepted") && (
          <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: colors.muted, fontWeight: "700" }}>Tempo de Uso Restante</Text>
            <RentalTimer deliveredAt={rental.deliveredAt} days={rental.days} />
          </View>
        )}

        {/* Deliverer banner when in transit */}
        {rental.status === "delivering" && rental.delivererName && (
          <View style={{ padding: 14, borderRadius: 14, backgroundColor: "#F9731622", borderWidth: 1, borderColor: "#F9731644", flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F97316", justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>{rental.delivererName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Entregador responsável</Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: "#F97316" }}>{rental.delivererName}</Text>
            </View>
          </View>
        )}

        {/* Pagamento Pendente - Instruções */}
        {rental.status === "awaiting_payment" && (
          <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <IconSymbol name="clock" size={18} color={colors.primary} />
                <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "700" }}>
                  Pague em até {formatTime(timeLeft)}
                </Text>
              </View>
              <Pressable onPress={handleManualCancel} disabled={isCancelling} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                {isCancelling ? <ActivityIndicator size="small" color={colors.error} /> : <Text style={{ fontSize: 13, color: colors.error, fontWeight: "700" }}>Cancelar</Text>}
              </Pressable>
            </View>

            {rental.paymentMethod === "PIX" && pixCode && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>Chave Copia e Cola PIX:</Text>
                <TextInput
                  value={pixCode}
                  editable={false}
                  selectTextOnFocus
                  style={{ fontSize: 12, fontFamily: Platform.OS === "web" ? "monospace" : undefined, color: colors.muted, backgroundColor: colors.background, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                />
              </View>
            )}

            {rental.paymentMethod === "BOLETO" && boletoInfo && (
              <View style={{ gap: 8 }}>
                {boletoInfo.barcode && (
                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.foreground }}>Código de Barras:</Text>
                    <TextInput
                      value={boletoInfo.barcode}
                      editable={false}
                      selectTextOnFocus
                      style={{ fontSize: 12, fontFamily: Platform.OS === "web" ? "monospace" : undefined, color: colors.muted, backgroundColor: colors.background, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border }}
                    />
                  </View>
                )}
                {boletoInfo.bookletUrl && (
                  <Pressable onPress={() => Linking.openURL(boletoInfo.bookletUrl!)} style={({ pressed }) => [{ backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: "center", opacity: pressed ? 0.85 : 1 }]}>
                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Visualizar Boleto (PDF)</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* Retry payment CTA for awaiting_payment */}
            <Pressable
              onPress={() => {
                setRetryCardNumber("");
                setRetryCardHolder("");
                setRetryCardExpiry("");
                setRetryCardCvv("");
                setRetryInstallments("1");
                setShowRetryModal(true);
              }}
              style={({ pressed }) => [
                { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                {rental.paymentMethod === "CREDIT_CARD" || rental.paymentMethod === "DEBIT_CARD"
                  ? "Tentar Pagar Novamente"
                  : "Ver Opção de Pagamento"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Produto */}
        <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>Ferramenta Alugada</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Image source={{ uri: rental.toolImage }} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: colors.border }} />
            <View style={{ flex: 1, justifyContent: "center", gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{rental.toolName}</Text>
              <Text style={{ fontSize: 13, color: colors.muted }}>Fornecedor: {rental.companyName}</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>
                {rental.days} {rental.days > 1 ? "dias" : "dia"}
              </Text>
            </View>
          </View>
        </View>

        {/* Entrega */}
        <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>Dados de Entrega</Text>
          <View style={{ gap: 4 }}>
            {rental.address ? (
              <>
                <Text style={{ fontSize: 14, color: colors.foreground, fontWeight: "600" }}>{rental.address.street}, {rental.address.number}</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  {rental.address.neighborhood} - {rental.address.city} / {rental.address.state}
                </Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>CEP: {rental.address.cep}</Text>
                {rental.address.complement ? <Text style={{ fontSize: 13, color: colors.muted }}>Complemento: {rental.address.complement}</Text> : null}
              </>
            ) : (
              <Text style={{ fontSize: 14, color: colors.muted }}>Retirada no local</Text>
            )}

            {/* Deliverer Name */}
            {rental.delivererName ? (
              <View style={{ marginTop: 8, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 8 }}>
                <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>Entregador: <Text style={{ fontWeight: "400", color: colors.muted }}>{rental.delivererName}</Text></Text>
              </View>
            ) : null}

            {/* Receiver / Return Name & CPF */}
            {rental.receiverName ? (
              <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: colors.border, gap: 2 }}>
                <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>
                  {rental.status === "completed" ? "Devolvido por: " : "Recebido por: "}
                  <Text style={{ fontWeight: "400", color: colors.muted }}>{rental.receiverName}</Text>
                </Text>
                {rental.receiverCpf ? (
                  <Text style={{ fontSize: 13, color: colors.foreground, fontWeight: "600" }}>
                    {rental.status === "completed" ? "CPF de quem devolveu: " : "CPF do Recebedor: "}
                    <Text style={{ fontWeight: "400", color: colors.muted }}>{rental.receiverCpf}</Text>
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        {/* Fotos da Entrega (Visíveis para todos que acessam o pedido) */}
        {rental.deliveryPhotos && rental.deliveryPhotos.length > 0 ? (
          <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <IconSymbol name="camera.fill" size={18} color={colors.primary} />
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>Fotos da Entrega</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              {rental.deliveryPhotos.map((photoUrl, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => setViewingPhotoUrl(photoUrl)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
                >
                  <Image
                    source={{ uri: photoUrl }}
                    style={{ width: 84, height: 84, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}
                    resizeMode="cover"
                  />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Observações do Cliente */}
        {rental.customerNote ? (
          <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground }}>Observações do Pedido</Text>
            <Text style={{ fontSize: 14, color: colors.muted }}>{rental.customerNote}</Text>
          </View>
        ) : null}

        {/* Resumo Financeiro */}
        <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: colors.foreground, marginBottom: 4 }}>Pagamento</Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: colors.muted, fontSize: 14 }}>Método selecionado</Text>
            <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: "600" }}>
              {rental.paymentMethod === "PIX" ? "PIX" : rental.paymentMethod === "BOLETO" ? "Boleto" : rental.paymentMethod === "CREDIT_CARD" ? "Cartão de Crédito" : "Cartão de Débito"}
            </Text>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Frete</Text>
            <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: "600" }}>
              {rental.shippingPrice && rental.shippingPrice > 0 ? `R$ ${rental.shippingPrice.toFixed(2)}` : "Grátis"}
            </Text>
          </View>

          {rental.couponDiscount && rental.couponDiscount > 0 ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: colors.success, fontSize: 13 }}>Desconto ({rental.couponCode})</Text>
              <Text style={{ color: colors.success, fontSize: 13, fontWeight: "600" }}>- R$ {rental.couponDiscount.toFixed(2)}</Text>
            </View>
          ) : null}

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>Total Pago</Text>
            <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: "800" }}>R$ {rental.totalPrice.toFixed(2)}</Text>
          </View>
        </View>

        {/* Ações pós-pagamento */}
        {isStatusLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <>
            {/* Delivery/Company/Owner Actions */}
            {canManageDelivery && rental.status === "pending" && (
              <Pressable
                onPress={openStartDeliveryModal}
                style={({ pressed }) => [
                  { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Iniciar Entrega</Text>
              </Pressable>
            )}

            {canManageDelivery && rental.status === "delivering" && (
              <Pressable
                onPress={() => {
                  if (isPickup) {
                    handleUpdateStatus("delivered");
                  } else {
                    setReceiverCpf("");
                    setShowReceiverModal(true);
                  }
                }}
                style={({ pressed }) => [
                  { backgroundColor: colors.success, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Finalizar Entrega</Text>
              </Pressable>
            )}

            {/* Customer Actions: Entregar Antecipadamente (not for owner or company) */}
            {!isDeliverer && !isCompany && !isOwner && (rental.status === "delivered" || rental.status === "active") && (
              <Pressable
                onPress={() => handleUpdateStatus("accepted")}
                style={({ pressed }) => [
                  { backgroundColor: "#8B5CF6", borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Entregar antecipadamente</Text>
              </Pressable>
            )}

            {/* Owner Actions: Cancelar Pedido */}
            {isOwner && rental.status !== "cancelled" && rental.status !== "completed" && (
              <Pressable
                onPress={handleManualCancel}
                disabled={isCancelling}
                style={({ pressed }) => [
                  { backgroundColor: "#EF4444", borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: isCancelling ? 0.5 : pressed ? 0.85 : 1 },
                ]}
              >
                {isCancelling
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Cancelar Pedido</Text>
                }
              </Pressable>
            )}

            {/* Company / Deliverer Actions: Accept/Reject Early Return */}
            {canManageDelivery && rental.status === "accepted" && (
              <View style={{ gap: 10 }}>
                <Pressable
                  onPress={() => handleUpdateStatus("return_expired")}
                  style={({ pressed }) => [
                    { backgroundColor: colors.success, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Aceitar Entrega Antecipada</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleUpdateStatus("active")}
                  style={({ pressed }) => [
                    { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error, borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={{ color: colors.error, fontWeight: "800", fontSize: 15 }}>Recusar Entrega Antecipada</Text>
                </Pressable>
              </View>
            )}

            {/* Deliverer / Company / Owner: Confirmar Devolução */}
            {canManageDelivery && rental.status === "return_expired" && (
              <Pressable
                onPress={() => {
                  setReceiverName("");
                  setReceiverCpf("");
                  setShowReturnModal(true);
                }}
                style={({ pressed }) => [
                  { backgroundColor: "#EF4444", borderRadius: 14, paddingVertical: 14, alignItems: "center", opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>
                  {isPickup ? "Confirmar Devolução no Balcão" : "Confirmar Devolução"}
                </Text>
              </Pressable>
            )}
          </>
        )}

        {rental.status === "completed" && user?.profile === "customer" && (
          <View style={{ padding: 16, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10, alignItems: "center", width: "100%" }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
              {rental.rating ? "Sua avaliação" : "Avalie este serviço"}
            </Text>
            <StarRating
              value={rental.rating ?? selectedRating}
              size={32}
              editable={!rental.rating}
              onChange={(v) => {
                setSelectedRating(v);
              }}
            />

            {!rental.rating && selectedRating > 0 && (
              <View style={{ width: "100%", gap: 10, marginTop: 8 }}>
                <TextInput
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  placeholder="Escreva sua opinião (opcional)"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  style={{
                    width: "100%",
                    minHeight: 60,
                    backgroundColor: colors.background,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    color: colors.foreground,
                    fontSize: 14,
                    textAlignVertical: "top",
                  }}
                />

                <Pressable
                  onPress={async () => {
                    if (isSubmittingRating) return;
                    setIsSubmittingRating(true);
                    try {
                      await rateRental(rental.id, selectedRating, ratingComment);
                      await Promise.all([refreshRentals(), refreshCatalog()]);
                      setSelectedRating(0);
                      setRatingComment("");
                      await fetchOrder();
                      Alert.alert("Sucesso", "Obrigado por avaliar!");
                    } catch (err: any) {
                      Alert.alert("Erro", err.message || "Não foi possível enviar a avaliação.");
                    } finally {
                      setIsSubmittingRating(false);
                    }
                  }}
                  style={({ pressed }) => [
                    {
                      width: "100%",
                      backgroundColor: colors.primary,
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: "center",
                      opacity: pressed || isSubmittingRating ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                    {isSubmittingRating ? "Enviando..." : "Enviar avaliação"}
                  </Text>
                </Pressable>
              </View>
            )}

            {rental.rating && rental.ratingComment && (
              <Text style={{ fontSize: 13, color: colors.muted, fontStyle: "italic", textAlign: "center", marginTop: 4 }}>
                "{rental.ratingComment}"
              </Text>
            )}
          </View>
        )}

      </ScrollView>

      {/* Modal para Finalizar Entrega */}
      <Modal visible={showReceiverModal} transparent={true} animationType="slide" onRequestClose={() => setShowReceiverModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Confirmar Entrega</Text>
              <Pressable onPress={() => setShowReceiverModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Código de Entrega (4 dígitos do CPF) */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Código de Entrega (últimos 4 dígitos do CPF)</Text>
              <TextInput
                value={receiverCpf}
                onChangeText={(text: string) => {
                  const cleaned = text.replace(/\D/g, "").slice(0, 4);
                  setReceiverCpf(cleaned);
                }}
                placeholder="0000"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                maxLength={4}
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: receiverCpf.length === 4
                    ? (isDeliveryCodeValid ? colors.success : "#EF4444")
                    : colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                  fontSize: 18,
                  fontWeight: "700",
                  letterSpacing: 4,
                  textAlign: "center",
                }}
              />
              {receiverCpf.length === 4 && !isDeliveryCodeValid && (
                <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "600" }}>
                  Código incorreto. Não coincide com os últimos 4 dígitos do CPF da conta do pedido.
                </Text>
              )}
              {receiverCpf.length === 4 && isDeliveryCodeValid && (
                <Text style={{ fontSize: 11, color: colors.success, fontWeight: "600" }}>
                  ✓ Código de entrega confirmado
                </Text>
              )}
            </View>

            {/* Fotos da Entrega (Comprovação) */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Fotos da Entrega (3 fotos obrigatórias)</Text>
              <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
                {[0, 1, 2].map((idx) => {
                  const img = deliveryPhotos[idx];
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => handleUploadDeliveryPhoto(idx)}
                      style={({ pressed }) => [
                        {
                          width: 80,
                          height: 80,
                          borderRadius: 12,
                          backgroundColor: colors.background,
                          borderWidth: img ? 1 : 1.5,
                          borderColor: img ? colors.primary : colors.border,
                          borderStyle: img ? "solid" : "dashed",
                          justifyContent: "center",
                          alignItems: "center",
                          overflow: "hidden",
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      {img ? (
                        <View style={{ width: "100%", height: "100%", position: "relative" }}>
                          <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              setDeliveryPhotos((prev) => {
                                const next = [...prev];
                                next[idx] = "";
                                return next;
                              });
                            }}
                            style={{ position: "absolute", top: 4, right: 4, backgroundColor: "#EF4444", borderRadius: 10, padding: 4 }}
                          >
                            <IconSymbol name="trash" size={12} color="#fff" />
                          </Pressable>
                        </View>
                      ) : (
                        <View style={{ alignItems: "center", gap: 2, padding: 4 }}>
                          <IconSymbol name="camera.fill" size={18} color={colors.muted} />
                          <Text style={{ fontSize: 10, color: colors.muted, fontWeight: "600" }}>Foto {idx + 1}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              {deliveryPhotos.filter(Boolean).length < 3 && (
                <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "600", textAlign: "center" }}>
                  As 3 fotos são obrigatórias para finalizar a entrega ({deliveryPhotos.filter(Boolean).length}/3 enviadas).
                </Text>
              )}
            </View>

            <Pressable
              onPress={() => {
                setShowReceiverModal(false);
                const validPhotos = deliveryPhotos.filter(Boolean);
                handleUpdateStatus("delivered", undefined, receiverCpf, validPhotos);
              }}
              disabled={!isDeliveryCodeValid || deliveryPhotos.filter(Boolean).length < 3}
              style={({ pressed }) => [
                {
                  backgroundColor: colors.success,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: (!isDeliveryCodeValid || deliveryPhotos.filter(Boolean).length < 3) ? 0.4 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Finalizar Entrega</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal para Confirmar Devolução */}
      <Modal visible={showReturnModal} transparent={true} animationType="slide" onRequestClose={() => setShowReturnModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Confirmar Devolução</Text>
              <Pressable onPress={() => setShowReturnModal(false)}>
                <IconSymbol name="xmark" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <View style={{ padding: 12, borderRadius: 10, backgroundColor: "#EF444422" }}>
              <Text style={{ fontSize: 13, color: "#EF4444", fontWeight: "600", textAlign: "center" }}>
                O período de aluguel expirou. Confirme a devolução registrando o CPF e nome de quem está devolvendo.
              </Text>
            </View>

            {/* CPF field first */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>CPF de Quem Devolve</Text>
              <TextInput
                value={receiverCpf}
                onChangeText={(text: string) => {
                  const cleaned = text.replace(/\D/g, "");
                  const limited = cleaned.slice(0, 11);
                  let formatted = limited;
                  if (limited.length > 9) {
                    formatted = `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9, 11)}`;
                  } else if (limited.length > 6) {
                    formatted = `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
                  } else if (limited.length > 3) {
                    formatted = `${limited.slice(0, 3)}.${limited.slice(3)}`;
                  }
                  setReceiverCpf(formatted);
                  if (limited.length !== 11) setReceiverName("");
                }}
                placeholder="000.000.000-00"
                placeholderTextColor={colors.muted}
                keyboardType="numeric"
                style={{
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: isCpfValid ? colors.success : colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                }}
              />
              {receiverCpf.replace(/\D/g, "").length === 11 && !isCpfValid && (
                <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "600" }}>CPF inválido. Verifique os dígitos.</Text>
              )}
              {isCpfValid && (
                <Text style={{ fontSize: 11, color: colors.success, fontWeight: "600" }}>✓ CPF válido</Text>
              )}
            </View>

            {/* Name field - only enabled when CPF is valid */}
            <View style={{ gap: 6, opacity: isCpfValid ? 1 : 0.4 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Nome Completo de Quem Devolve</Text>
              <TextInput
                value={receiverName}
                onChangeText={setReceiverName}
                placeholder="Ex: João da Silva"
                placeholderTextColor={colors.muted}
                editable={isCpfValid}
                style={{
                  backgroundColor: isCpfValid ? colors.background : colors.border + "44",
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  color: colors.foreground,
                }}
              />
            </View>

            <Pressable
              onPress={() => {
                setShowReturnModal(false);
                handleUpdateStatus("completed", receiverName, receiverCpf);
              }}
              disabled={!isCpfValid || !receiverName.trim()}
              style={({ pressed }) => [
                {
                  backgroundColor: "#EF4444",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: (!isCpfValid || !receiverName.trim()) ? 0.4 : pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Confirmar Devolução</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Modal de Retry de Pagamento */}
      <Modal visible={showRetryModal} transparent={true} animationType="slide" onRequestClose={() => setShowRetryModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "85%" }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Tentar Pagar Novamente</Text>
                <Pressable onPress={() => setShowRetryModal(false)}>
                  <IconSymbol name="xmark" size={24} color={colors.foreground} />
                </Pressable>
              </View>

              {/* Summary */}
              {rental && (
                <View style={{ padding: 14, borderRadius: 14, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, gap: 6, marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>{rental.toolName}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>Empresa: {rental.companyName} · {rental.days} dia{rental.days > 1 ? "s" : ""}</Text>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: colors.primary }}>Total: R$ {rental.totalPrice.toFixed(2)}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <IconSymbol name="creditcard.fill" size={14} color={colors.muted} />
                    <Text style={{ fontSize: 12, color: colors.muted }}>
                      {rental.paymentMethod === "CREDIT_CARD" ? "Cartão de Crédito" :
                        rental.paymentMethod === "DEBIT_CARD" ? "Cartão de Débito" :
                          rental.paymentMethod === "PIX" ? "PIX" : "Boleto"}
                    </Text>
                  </View>
                </View>
              )}

              {/* Card form - shown only for card payments */}
              {rental && (rental.paymentMethod === "CREDIT_CARD" || rental.paymentMethod === "DEBIT_CARD") && (
                <View style={{ gap: 12, marginBottom: 16 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>Dados do Cartão</Text>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Número do Cartão</Text>
                    <TextInput
                      value={retryCardNumber}
                      onChangeText={(t: string) => {
                        const d = t.replace(/\D/g, "").slice(0, 16);
                        setRetryCardNumber(d.replace(/(\d{4})(?=\d)/g, "$1 ").trim());
                      }}
                      placeholder="0000 0000 0000 0000"
                      placeholderTextColor={colors.muted}
                      keyboardType="numeric"
                      style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground, fontSize: 16, letterSpacing: 2 }}
                    />
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Nome no Cartão</Text>
                    <TextInput
                      value={retryCardHolder}
                      onChangeText={(t) => setRetryCardHolder(t.toUpperCase())}
                      placeholder="NOME SOBRENOME"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="characters"
                      style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground }}
                    />
                  </View>

                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Validade (MM/AA)</Text>
                      <TextInput
                        value={retryCardExpiry}
                        onChangeText={(t) => {
                          const d = t.replace(/\D/g, "").slice(0, 4);
                          setRetryCardExpiry(d.length > 2 ? d.slice(0, 2) + "/" + d.slice(2) : d);
                        }}
                        placeholder="12/28"
                        placeholderTextColor={colors.muted}
                        keyboardType="numeric"
                        style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground }}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>CVV</Text>
                      <TextInput
                        value={retryCardCvv}
                        onChangeText={(t) => setRetryCardCvv(t.replace(/\D/g, "").slice(0, 4))}
                        placeholder="123"
                        placeholderTextColor={colors.muted}
                        keyboardType="numeric"
                        secureTextEntry
                        style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.foreground }}
                      />
                    </View>
                  </View>

                  {rental.paymentMethod === "CREDIT_CARD" && (
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Parcelas</Text>
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        {["1", "2", "3", "6", "12"].map((n) => (
                          <Pressable
                            key={n}
                            onPress={() => setRetryInstallments(n)}
                            style={({ pressed }) => [{
                              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
                              backgroundColor: retryInstallments === n ? colors.primary : colors.background,
                              borderWidth: 1, borderColor: retryInstallments === n ? colors.primary : colors.border,
                              opacity: pressed ? 0.8 : 1,
                            }]}
                          >
                            <Text style={{ fontSize: 13, fontWeight: "700", color: retryInstallments === n ? "#fff" : colors.foreground }}>{n}x</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* PIX / Boleto notice */}
              {rental && rental.paymentMethod !== "CREDIT_CARD" && rental.paymentMethod !== "DEBIT_CARD" && (
                <View style={{ padding: 12, borderRadius: 12, backgroundColor: colors.info + "15" ?? colors.border, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: colors.foreground, textAlign: "center" }}>
                    Um novo código será gerado para você ao confirmar. Verifique os dados do pedido acima.
                  </Text>
                </View>
              )}

              <Pressable
                onPress={handleRetryPayment}
                disabled={isRetrying}
                style={({ pressed }) => [{
                  backgroundColor: colors.primary,
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: "center",
                  opacity: pressed || isRetrying ? 0.75 : 1,
                  marginBottom: 8,
                }]}
              >
                {isRetrying
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>Confirmar Pagamento</Text>
                }
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Processing Loading Modal */}
      <Modal visible={paymentLoadingVisible} transparent animationType="fade" statusBarTranslucent>
        <View style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.75)",
          justifyContent: "center",
          alignItems: "center",
          padding: 32,
        }}>
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 36,
            alignItems: "center",
            gap: 20,
            width: "100%",
            maxWidth: 340,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 20,
          }}>
            {paymentLoadingStatus === "processing" && (
              <>
                <Animated.View style={{
                  transform: [{
                    rotate: spinAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0deg", "360deg"],
                    }),
                  }],
                }}>
                  <View style={{
                    width: 72,
                    height: 72,
                    borderRadius: 36,
                    borderWidth: 5,
                    borderColor: colors.primary + "33",
                    borderTopColor: colors.primary,
                  }} />
                </Animated.View>
                <View style={{ alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Verificando Pagamento</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
                    Aguarde enquanto processamos o seu pagamento...
                  </Text>
                </View>
              </>
            )}

            {paymentLoadingStatus === "success" && (
              <>
                <View style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: "#22C55E22",
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 3,
                  borderColor: "#22C55E",
                }}>
                  <Text style={{ fontSize: 36 }}>✓</Text>
                </View>
                <View style={{ alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#22C55E" }}>Pagamento Aprovado!</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
                    Pedido atualizado. Redirecionando...
                  </Text>
                </View>
              </>
            )}

            {paymentLoadingStatus === "failed" && (
              <>
                <View style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: "#EF444422",
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 3,
                  borderColor: "#EF4444",
                }}>
                  <Text style={{ fontSize: 36 }}>✗</Text>
                </View>
                <View style={{ alignItems: "center", gap: 8 }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#EF4444" }}>Pagamento Recusado</Text>
                  <Text style={{ fontSize: 13, color: colors.muted, textAlign: "center" }}>
                    Tente com outro método de pagamento.
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal de Fotos do Produto Antes da Entrega */}
      <Modal visible={showStartDeliveryModal} transparent animationType="slide" onRequestClose={() => setShowStartDeliveryModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <IconSymbol name="camera.fill" size={20} color={colors.primary} />
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.foreground }}>Fotos para Entrega</Text>
              </View>
              <Pressable onPress={() => setShowStartDeliveryModal(false)}>
                <IconSymbol name="xmark" size={22} color={colors.foreground} />
              </Pressable>
            </View>

            <Text style={{ fontSize: 14, color: colors.muted, lineHeight: 20 }}>
              Enviar as 3 fotos obrigatórias das ferramentas que estão indo para entrega.
            </Text>

            {/* 3 Upload Boxes */}
            <View style={{ flexDirection: "row", gap: 12, justifyContent: "center", marginVertical: 8 }}>
              {[0, 1, 2].map((idx) => {
                const img = deliveryPhotos[idx];
                return (
                  <Pressable
                    key={idx}
                    onPress={() => handleUploadDeliveryPhoto(idx)}
                    style={({ pressed }) => [
                      {
                        width: 86,
                        height: 86,
                        borderRadius: 14,
                        backgroundColor: colors.background,
                        borderWidth: img ? 1 : 1.5,
                        borderColor: img ? colors.primary : colors.border,
                        borderStyle: img ? "solid" : "dashed",
                        justifyContent: "center",
                        alignItems: "center",
                        overflow: "hidden",
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    {img ? (
                      <View style={{ width: "100%", height: "100%", position: "relative" }}>
                        <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                        <Pressable
                          onPress={(e) => {
                            e.stopPropagation();
                            setDeliveryPhotos((prev) => {
                              const next = [...prev];
                              next[idx] = "";
                              return next;
                            });
                          }}
                          style={{ position: "absolute", top: 4, right: 4, backgroundColor: "#EF4444", borderRadius: 12, padding: 5 }}
                        >
                          <IconSymbol name="trash" size={14} color="#fff" />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={{ alignItems: "center", gap: 4, padding: 4 }}>
                        <IconSymbol name="camera.fill" size={20} color={colors.muted} />
                        <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "600" }}>Foto {idx + 1}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {deliveryPhotos.filter(Boolean).length < 3 && (
              <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "600", textAlign: "center" }}>
                As 3 fotos são obrigatórias para iniciar a entrega ({deliveryPhotos.filter(Boolean).length}/3 enviadas).
              </Text>
            )}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={() => setShowStartDeliveryModal(false)}
                style={({ pressed }) => [
                  { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 15 }}>Cancelar</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmStartDelivery}
                disabled={deliveryPhotos.filter(Boolean).length < 3}
                style={({ pressed }) => [
                  { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", opacity: deliveryPhotos.filter(Boolean).length < 3 ? 0.4 : pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Visualização da Foto da Entrega em Tela Cheia */}
      <Modal visible={!!viewingPhotoUrl} transparent animationType="fade" onRequestClose={() => setViewingPhotoUrl(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center", padding: 16 }}>
          <Pressable onPress={() => setViewingPhotoUrl(null)} style={{ position: "absolute", top: 40, right: 20, zIndex: 10, padding: 10 }}>
            <IconSymbol name="xmark" size={28} color="#fff" />
          </Pressable>
          {viewingPhotoUrl && (
            <Image
              source={{ uri: viewingPhotoUrl }}
              style={{ width: "100%", height: "80%", borderRadius: 12 }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </ScreenContainer>
  );
}
