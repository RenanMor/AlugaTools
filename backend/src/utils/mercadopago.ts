import axios, { AxiosInstance } from "axios";
import { randomUUID } from "crypto";
import { env } from "../config/env";

// ---------- Types ----------

export interface MercadoPagoPayer {
  email: string;
  first_name?: string;
  last_name?: string;
  identification: {
    type: "CPF" | "CNPJ";
    number: string;
  };
}

export interface MercadoPagoItem {
  id?: string;
  title: string;
  description?: string;
  quantity: number;
  unit_price: number;
}

export interface MercadoPagoCardInput {
  number: string;
  holder_name: string;
  exp_month: string | number;
  exp_year: string | number;
  security_code: string;
}

// ---------- API Client ----------

function createMercadoPagoClient(): AxiosInstance {
  return axios.create({
    baseURL: (env.mercadoPagoBaseUrl || "https://api.mercadopago.com").trim(),
    headers: {
      Authorization: `Bearer ${env.mercadoPagoAccessToken.trim()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}

// ---------- Card Brand Detection ----------

export function detectCardPaymentMethod(cardNumber: string, isDebit = false): string {
  const clean = cardNumber.replace(/\D/g, "");
  if (isDebit) {
    if (/^4/.test(clean)) return "debvisa";
    if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(clean)) return "debmaster";
    if (/^(4011|438935|451416|4576|504175|5067|5090|627780|636297|636368)/.test(clean)) return "debelo";
    return "debvisa";
  }
  if (/^4/.test(clean)) return "visa";
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(clean)) return "master";
  if (/^(4011|438935|451416|4576|504175|5067|5090|627780|636297|636368)/.test(clean)) return "elo";
  if (/^3[47]/.test(clean)) return "amex";
  if (/^(606282|3841)/.test(clean)) return "hipercard";
  return "visa";
}

// ---------- Card Token Generation ----------

export async function createMercadoPagoCardToken(card: MercadoPagoCardInput, payer: MercadoPagoPayer): Promise<string> {
  const baseURL = (env.mercadoPagoBaseUrl || "https://api.mercadopago.com").trim();
  const cleanCardNumber = card.number.replace(/\s/g, "");
  const expMonth = Number(card.exp_month);
  let expYear = Number(card.exp_year);
  if (expYear < 100) expYear += 2000;

  const payload = {
    card_number: cleanCardNumber,
    expiration_month: expMonth,
    expiration_year: expYear,
    security_code: card.security_code,
    cardholder: {
      name: card.holder_name,
      identification: payer.identification,
    },
  };

  try {
    // Card tokenization uses PUBLIC_KEY (not Bearer token) — PCI requirement
    const publicKey = env.mercadoPagoPublicKey.trim();
    const res = await axios.post(`${baseURL}/v1/card_tokens`, payload, {
      params: publicKey ? { public_key: publicKey } : undefined,
      headers: {
        // Use public key only — DO NOT send Authorization header for card tokens
        "Content-Type": "application/json",
        "X-Idempotency-Key": randomUUID(),
      },
    });
    console.log("[MercadoPago] Card token created:", res.data.id);
    return res.data.id;
  } catch (error: any) {
    console.error("[MercadoPago] createCardToken error:", JSON.stringify(error.response?.data || error.message, null, 2));
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.cause?.[0]?.description ||
      error.message ||
      "Erro ao validar dados do cartão";
    throw new Error(errorMsg);
  }
}

// ===========================================================
// 1. PIX — via Orders API (POST /v1/orders)
// ===========================================================

export async function mercadopagoPayPix(input: {
  referenceId: string;
  amount: number;
  description: string;
  payer: MercadoPagoPayer;
}) {
  const api = createMercadoPagoClient();

  const payload = {
    type: "online",
    processing_mode: "automatic",
    external_reference: input.referenceId,
    description: input.description,
    total_amount: input.amount.toFixed(2),
    payer: {
      email: input.payer.email,
    },
    transactions: {
      payments: [
        {
          amount: input.amount.toFixed(2),
          payment_method: {
            id: "pix",
            type: "bank_transfer",
          },
        },
      ],
    },
  };

  try {
    const res = await api.post("/v1/orders", payload, {
      headers: { "X-Idempotency-Key": randomUUID() },
    });

    const order = res.data;
    const payment = order.transactions?.payments?.[0];
    const txData = payment?.point_of_interaction?.transaction_data;

    console.log("[MercadoPago] PIX order created:", order.id, "status:", order.status);

    return {
      paymentId: order.id,
      status: order.status,
      pixQrCode: txData?.qr_code_base64 || null,
      pixCopyPaste: txData?.qr_code || null,
      ticketUrl: txData?.ticket_url || null,
      rawResponse: order,
    };
  } catch (error: any) {
    console.error("[MercadoPago] payPix error:", JSON.stringify(error.response?.data || error.message, null, 2));
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.cause?.[0]?.description ||
      error.message ||
      "Erro ao gerar PIX no Mercado Pago";
    throw new Error(errorMsg);
  }
}

// ===========================================================
// 2. Credit Card — via Orders API (POST /v1/orders)
// ===========================================================

export async function mercadopagoPayCreditCard(input: {
  referenceId: string;
  amount: number;
  description: string;
  card: MercadoPagoCardInput;
  installments?: number;
  payer: MercadoPagoPayer;
}) {
  const api = createMercadoPagoClient();

  // Generate card token first
  const token = await createMercadoPagoCardToken(input.card, input.payer);
  const paymentMethodId = detectCardPaymentMethod(input.card.number, false);

  const payload = {
    type: "online",
    processing_mode: "automatic",
    external_reference: input.referenceId,
    description: input.description,
    total_amount: input.amount.toFixed(2),
    payer: {
      email: input.payer.email,
    },
    transactions: {
      payments: [
        {
          amount: input.amount.toFixed(2),
          payment_method: {
            id: paymentMethodId,
            type: "credit_card",
            token,
            installments: input.installments || 1,
          },
        },
      ],
    },
  };

  try {
    const res = await api.post("/v1/orders", payload, {
      headers: { "X-Idempotency-Key": randomUUID() },
    });

    const order = res.data;
    const payment = order.transactions?.payments?.[0];
    const isApproved = order.status === "processed" || payment?.status === "processed";

    console.log("[MercadoPago] Credit card order created:", order.id, "status:", order.status);

    return {
      paymentId: order.id,
      status: order.status,
      statusDetail: order.status_detail,
      isApproved,
      rawResponse: order,
    };
  } catch (error: any) {
    console.error("[MercadoPago] payCreditCard error:", JSON.stringify(error.response?.data || error.message, null, 2));
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.cause?.[0]?.description ||
      error.message ||
      "Erro ao processar cartão de crédito no Mercado Pago";
    throw new Error(errorMsg);
  }
}

// ===========================================================
// 3. Debit Card — via Orders API (POST /v1/orders)
// ===========================================================

export async function mercadopagoPayDebitCard(input: {
  referenceId: string;
  amount: number;
  description: string;
  card: MercadoPagoCardInput;
  payer: MercadoPagoPayer;
}) {
  const api = createMercadoPagoClient();

  const token = await createMercadoPagoCardToken(input.card, input.payer);
  const paymentMethodId = detectCardPaymentMethod(input.card.number, true);

  const payload = {
    type: "online",
    processing_mode: "automatic",
    external_reference: input.referenceId,
    description: input.description,
    total_amount: input.amount.toFixed(2),
    payer: {
      email: input.payer.email,
    },
    transactions: {
      payments: [
        {
          amount: input.amount.toFixed(2),
          payment_method: {
            id: paymentMethodId,
            type: "debit_card",
            token,
            installments: 1,
          },
        },
      ],
    },
  };

  try {
    const res = await api.post("/v1/orders", payload, {
      headers: { "X-Idempotency-Key": randomUUID() },
    });

    const order = res.data;
    const payment = order.transactions?.payments?.[0];
    const isApproved = order.status === "processed" || payment?.status === "processed";
    const authUrl =
      payment?.point_of_interaction?.transaction_data?.external_resource_url ||
      null;

    console.log("[MercadoPago] Debit card order created:", order.id, "status:", order.status);

    return {
      paymentId: order.id,
      status: order.status,
      statusDetail: order.status_detail,
      isApproved,
      authenticationUrl: authUrl,
      rawResponse: order,
    };
  } catch (error: any) {
    console.error("[MercadoPago] payDebitCard error:", JSON.stringify(error.response?.data || error.message, null, 2));
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.cause?.[0]?.description ||
      error.message ||
      "Erro ao processar cartão de débito no Mercado Pago";
    throw new Error(errorMsg);
  }
}

// ===========================================================
// 4. Saldo Mercado Pago / Wallet (Checkout Preference)
// ===========================================================

export async function mercadopagoPayWallet(input: {
  referenceId: string;
  items: MercadoPagoItem[];
  payer: MercadoPagoPayer;
  backUrl?: string;
}) {
  const api = createMercadoPagoClient();
  const defaultBackUrl = input.backUrl || "https://aluga-tools.vercel.app/orders";

  const payload = {
    items: input.items.map((item) => ({
      id: item.id || "item_1",
      title: item.title,
      description: item.description || item.title,
      quantity: item.quantity,
      unit_price: Number(item.unit_price.toFixed(2)),
      currency_id: "BRL",
    })),
    payer: {
      name: input.payer.first_name,
      surname: input.payer.last_name,
      email: input.payer.email,
      identification: input.payer.identification,
    },
    external_reference: input.referenceId,
    back_urls: {
      success: defaultBackUrl,
      pending: defaultBackUrl,
      failure: defaultBackUrl,
    },
    auto_return: "approved",
    statement_descriptor: "ALUGATOOLS",
  };

  try {
    const res = await api.post("/checkout/preferences", payload, {
      headers: { "X-Idempotency-Key": randomUUID() },
    });
    const pref = res.data;
    return {
      preferenceId: pref.id,
      initPoint: pref.init_point,
      sandboxInitPoint: pref.sandbox_init_point,
      rawResponse: pref,
    };
  } catch (error: any) {
    console.error("[MercadoPago] payWallet error:", JSON.stringify(error.response?.data || error.message, null, 2));
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.cause?.[0]?.description ||
      error.message ||
      "Erro ao gerar preferência para Saldo Mercado Pago";
    throw new Error(errorMsg);
  }
}

// ===========================================================
// Status Queries
// ===========================================================

export async function getMercadoPagoPaymentStatus(orderId: string) {
  const api = createMercadoPagoClient();
  try {
    // Orders API first
    const res = await api.get(`/v1/orders/${orderId}`);
    const order = res.data;
    const isPaid = order.status === "processed" || order.status === "paid";
    return { isPaid, status: order.status, paymentData: { ...order, external_reference: order.external_reference } };
  } catch (err: any) {
    // Fallback: legacy payments API
    try {
      const res2 = await api.get(`/v1/payments/${orderId}`);
      const payment = res2.data;
      const isPaid = payment.status === "approved";
      return { isPaid, status: payment.status, paymentData: payment };
    } catch {
      console.error("[MercadoPago] getPaymentStatus error for orderId:", orderId);
      return { isPaid: false, status: "error", paymentData: null };
    }
  }
}

export async function getMercadoPagoOrderStatus(orderId: string) {
  const api = createMercadoPagoClient();
  try {
    const res = await api.get(`/v1/orders/${orderId}`);
    const order = res.data;
    const isPaid = order.status === "processed" || order.status === "paid";
    return { isPaid, status: order.status, orderData: order };
  } catch (error: any) {
    console.error("[MercadoPago] getOrderStatus error:", error.response?.status || error.message);
    return { isPaid: false, status: "error", orderData: null };
  }
}
