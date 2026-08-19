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
  address?: {
    zip_code?: string;
    street_name?: string;
    street_number?: number;
    neighborhood?: string;
    city?: string;
    federal_unit?: string;
  };
  phone?: {
    area_code?: string;
    number?: string;
  };
}

export interface MercadoPagoItem {
  id?: string;
  title: string;
  description?: string;
  quantity: number;
  unit_price: number; // in BRL (e.g. 150.00)
  category_id?: string;
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
  const token = env.mercadoPagoAccessToken;

  return axios.create({
    baseURL: env.mercadoPagoBaseUrl || "https://api.mercadopago.com",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}

// ---------- Card Brand Detection Helper ----------

export function detectCardPaymentMethod(cardNumber: string, isDebit = false): string {
  const clean = cardNumber.replace(/\D/g, "");
  
  if (isDebit) {
    if (/^4/.test(clean)) return "debvisa";
    if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(clean)) return "debmaster";
    if (/^(4011|438935|451416|4576|504175|5067|5090|627780|636297|636368)/.test(clean)) return "elo";
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
  const api = createMercadoPagoClient();
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
    const params = env.mercadoPagoPublicKey ? { public_key: env.mercadoPagoPublicKey } : {};
    const res = await api.post("/v1/card_tokens", payload, {
      params,
      headers: {
        "X-Idempotency-Key": randomUUID(),
      },
    });
    return res.data.id;
  } catch (error: any) {
    console.error("[MercadoPago] createCardToken error:", JSON.stringify(error.response?.data || error.message, null, 2));
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.cause?.[0]?.description ||
      error.message ||
      "Erro ao validar dados do cartão no Mercado Pago";
    throw new Error(errorMsg);
  }
}

// ---------- 1. PIX Payment ----------

export async function mercadopagoPayPix(input: {
  referenceId: string;
  amount: number; // in BRL (e.g. 50.00)
  description: string;
  payer: MercadoPagoPayer;
}) {
  const api = createMercadoPagoClient();

  const payload = {
    transaction_amount: Number(input.amount.toFixed(2)),
    description: input.description,
    payment_method_id: "pix",
    external_reference: input.referenceId,
    payer: {
      email: input.payer.email,
      first_name: input.payer.first_name || "Cliente",
      last_name: input.payer.last_name || "AlugaTools",
      identification: input.payer.identification,
      address: input.payer.address,
    },
  };

  try {
    const res = await api.post("/v1/payments", payload, {
      headers: {
        "X-Idempotency-Key": randomUUID(),
      },
    });

    const payment = res.data;
    const txData = payment.point_of_interaction?.transaction_data;

    return {
      paymentId: String(payment.id),
      status: payment.status,
      pixQrCode: txData?.qr_code_base64 || null,
      pixCopyPaste: txData?.qr_code || null,
      ticketUrl: txData?.ticket_url || null,
      rawResponse: payment,
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

// ---------- 2. Credit Card Payment ----------

export async function mercadopagoPayCreditCard(input: {
  referenceId: string;
  amount: number;
  description: string;
  card: MercadoPagoCardInput;
  installments?: number;
  payer: MercadoPagoPayer;
}) {
  const api = createMercadoPagoClient();

  // Step 1: Generate card token
  const token = await createMercadoPagoCardToken(input.card, input.payer);
  const paymentMethodId = detectCardPaymentMethod(input.card.number, false);

  const payload = {
    transaction_amount: Number(input.amount.toFixed(2)),
    token,
    description: input.description,
    installments: input.installments || 1,
    payment_method_id: paymentMethodId,
    external_reference: input.referenceId,
    payer: {
      email: input.payer.email,
      first_name: input.payer.first_name || "Cliente",
      last_name: input.payer.last_name || "AlugaTools",
      identification: input.payer.identification,
      address: input.payer.address,
    },
  };

  try {
    const res = await api.post("/v1/payments", payload, {
      headers: {
        "X-Idempotency-Key": randomUUID(),
      },
    });

    const payment = res.data;
    const isApproved = payment.status === "approved";

    return {
      paymentId: String(payment.id),
      status: payment.status,
      statusDetail: payment.status_detail,
      isApproved,
      rawResponse: payment,
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

// ---------- 3. Debit Card Payment ----------

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
    transaction_amount: Number(input.amount.toFixed(2)),
    token,
    description: input.description,
    installments: 1,
    payment_method_id: paymentMethodId,
    external_reference: input.referenceId,
    payer: {
      email: input.payer.email,
      first_name: input.payer.first_name || "Cliente",
      last_name: input.payer.last_name || "AlugaTools",
      identification: input.payer.identification,
      address: input.payer.address,
    },
  };

  try {
    const res = await api.post("/v1/payments", payload, {
      headers: {
        "X-Idempotency-Key": randomUUID(),
      },
    });

    const payment = res.data;
    const isApproved = payment.status === "approved";
    const authUrl =
      payment.transaction_details?.external_resource_url ||
      payment.point_of_interaction?.transaction_data?.url ||
      null;

    return {
      paymentId: String(payment.id),
      status: payment.status,
      statusDetail: payment.status_detail,
      isApproved,
      authenticationUrl: authUrl,
      rawResponse: payment,
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

// ---------- 4. Saldo Mercado Pago / Wallet (Checkout Preference) ----------

export async function mercadopagoPayWallet(input: {
  referenceId: string;
  items: MercadoPagoItem[];
  payer: MercadoPagoPayer;
  backUrl?: string;
}) {
  const api = createMercadoPagoClient();

  const defaultBackUrl = input.backUrl || "https://alugatools.com/orders";

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
      headers: {
        "X-Idempotency-Key": randomUUID(),
      },
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

// ---------- Get Payment / Order Status ----------

export async function getMercadoPagoPaymentStatus(paymentId: string) {
  const api = createMercadoPagoClient();

  try {
    const res = await api.get(`/v1/payments/${paymentId}`);
    const payment = res.data;
    const isPaid = payment.status === "approved";

    return { isPaid, status: payment.status, paymentData: payment };
  } catch (error: any) {
    console.error("[MercadoPago] getPaymentStatus error:", error.response?.status || error.message);
    return { isPaid: false, status: "error", paymentData: null };
  }
}

export async function getMercadoPagoOrderStatus(orderId: string) {
  const api = createMercadoPagoClient();

  try {
    const res = await api.get(`/v1/orders/${orderId}`);
    const order = res.data;
    const isPaid = order.status === "closed" || order.status === "paid";

    return { isPaid, status: order.status, orderData: order };
  } catch (error: any) {
    console.error("[MercadoPago] getOrderStatus error:", error.response?.status || error.message);
    return { isPaid: false, status: "error", orderData: null };
  }
}
