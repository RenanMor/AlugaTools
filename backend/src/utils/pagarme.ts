import axios, { AxiosInstance } from "axios";
import { env } from "../config/env";

// ---------- Types ----------

export interface PagarmeCustomer {
  name: string;
  email: string;
  document: string; // CPF (11 digits) or CNPJ (14 digits)
  document_type: "CPF" | "CNPJ";
  type: "individual" | "company";
  phones: {
    mobile_phone?: {
      country_code: string;
      area_code: string;
      number: string;
    };
  };
}

export interface PagarmeItem {
  amount: number; // in cents
  description: string;
  quantity: number;
  code?: string;
}

export interface PagarmeCardData {
  number: string;
  holder_name: string;
  exp_month: number;
  exp_year: number;
  cvv: string;
}

export interface PagarmeAddress {
  line_1: string; // "number, street, neighborhood"
  line_2?: string;
  zip_code: string;
  city: string;
  state: string;
  country: string;
}

// ---------- API Client ----------

function createPagarmeClient(): AxiosInstance {
  const secretKey = env.pagarmeSecretKey;
  const basicAuth = Buffer.from(`${secretKey}:`).toString("base64");

  return axios.create({
    baseURL: env.pagarmeBaseUrl || "https://api.pagar.me/core/v5",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}

// ---------- Create Order ----------

export async function createPagarmeOrder(input: {
  referenceId: string;
  customer: PagarmeCustomer;
  items: PagarmeItem[];
  payments: any[];
}) {
  const api = createPagarmeClient();

  const payload: any = {
    code: input.referenceId,
    customer: input.customer,
    items: input.items,
    payments: input.payments,
  };

  try {
    const response = await api.post("/orders", payload);
    return response.data;
  } catch (error: any) {
    console.error(
      "[Pagar.me] createOrder error:",
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    const errorMsg =
      error.response?.data?.message ||
      error.response?.data?.errors?.[0]?.message ||
      error.message ||
      "Erro ao criar pedido no Pagar.me";
    throw new Error(errorMsg);
  }
}

// ---------- PIX Payment ----------

export async function pagarmePayPix(input: {
  referenceId: string;
  customer: PagarmeCustomer;
  items: PagarmeItem[];
  amountCents: number;
  expiresInSeconds?: number;
}) {
  const payments = [
    {
      payment_method: "pix",
      pix: {
        expires_in: input.expiresInSeconds || 1800, // 30 minutes default
      },
    },
  ];

  const orderResult = await createPagarmeOrder({
    referenceId: input.referenceId,
    customer: input.customer,
    items: input.items,
    payments,
  });

  // Extract PIX QR code data from the charge
  const charge = orderResult.charges?.[0];
  const lastTransaction = charge?.last_transaction;

  return {
    orderId: orderResult.id,
    orderCode: orderResult.code,
    status: charge?.status || "pending",
    pixQrCode: lastTransaction?.qr_code || null,
    pixQrCodeUrl: lastTransaction?.qr_code_url || null,
    pixCopyPaste: lastTransaction?.qr_code || null,
    expiresAt: lastTransaction?.expires_at || null,
    rawResponse: orderResult,
  };
}

// ---------- Credit Card Payment ----------

export async function pagarmePayCreditCard(input: {
  referenceId: string;
  customer: PagarmeCustomer;
  items: PagarmeItem[];
  amountCents: number;
  card: PagarmeCardData;
  installments: number;
  billingAddress: PagarmeAddress;
}) {
  const payments = [
    {
      payment_method: "credit_card",
      credit_card: {
        installments: input.installments || 1,
        capture: true,
        card: {
          number: input.card.number.replace(/\s/g, ""),
          holder_name: input.card.holder_name,
          exp_month: input.card.exp_month,
          exp_year: input.card.exp_year,
          cvv: input.card.cvv,
          billing_address: input.billingAddress,
        },
      },
    },
  ];

  const orderResult = await createPagarmeOrder({
    referenceId: input.referenceId,
    customer: input.customer,
    items: input.items,
    payments,
  });

  const charge = orderResult.charges?.[0];

  return {
    orderId: orderResult.id,
    orderCode: orderResult.code,
    status: charge?.status || "pending",
    paymentResponse: charge?.last_transaction?.gateway_response || null,
    rawResponse: orderResult,
  };
}

// ---------- Debit Card Payment ----------

export async function pagarmePayDebitCard(input: {
  referenceId: string;
  customer: PagarmeCustomer;
  items: PagarmeItem[];
  amountCents: number;
  card: PagarmeCardData;
  billingAddress: PagarmeAddress;
}) {
  const payments = [
    {
      payment_method: "debit_card",
      debit_card: {
        card: {
          number: input.card.number.replace(/\s/g, ""),
          holder_name: input.card.holder_name,
          exp_month: input.card.exp_month,
          exp_year: input.card.exp_year,
          cvv: input.card.cvv,
          billing_address: input.billingAddress,
        },
        authentication: {
          type: "threeDSecure",
          threed_secure: {
            mpi: "null", // Let Pagar.me handle 3DS
          },
        },
      },
    },
  ];

  const orderResult = await createPagarmeOrder({
    referenceId: input.referenceId,
    customer: input.customer,
    items: input.items,
    payments,
  });

  const charge = orderResult.charges?.[0];

  return {
    orderId: orderResult.id,
    orderCode: orderResult.code,
    status: charge?.status || "pending",
    authenticationUrl: charge?.last_transaction?.authentication_url || null,
    paymentResponse: charge?.last_transaction?.gateway_response || null,
    rawResponse: orderResult,
  };
}

// ---------- Get Order Status ----------

export async function getPagarmeOrderStatus(orderId: string) {
  const api = createPagarmeClient();

  try {
    const response = await api.get(`/orders/${orderId}`);
    const order = response.data;
    const charges = order.charges || [];
    const isPaid = charges.some(
      (charge: any) => charge.status === "paid" || charge.status === "overpaid"
    );

    return { isPaid, status: order.status, orderData: order };
  } catch (error: any) {
    console.error(
      "[Pagar.me] getOrderStatus error:",
      error.response?.status || error.message
    );
    return { isPaid: false, status: "error", orderData: null };
  }
}
