import axios from "axios";
import { env } from "../config/env";

// ---------- Types ----------

export interface PagBankCustomer {
  name: string;
  email: string;
  tax_id: string; // CPF
  phones?: Array<{
    country: string;
    area: string;
    number: string;
    type: "MOBILE" | "HOME";
  }>;
}

export interface PagBankItem {
  reference_id: string;
  name: string;
  quantity: number;
  unit_amount: number; // in cents
}

export interface PagBankAddress {
  street: string;
  number: string;
  complement?: string;
  locality: string; // bairro
  city: string;
  region?: string; // UF
  region_code: string; // UF 2 chars
  country: string; // "BRA"
  postal_code: string; // CEP sem hífen
}

export interface PagBankCardData {
  number: string;
  exp_month: string;
  exp_year: string;
  security_code: string;
  holder: {
    name: string;
  };
}

export interface CreateOrderInput {
  referenceId: string;
  customer: PagBankCustomer;
  items: PagBankItem[];
  shippingAddress?: PagBankAddress;
  notificationUrls?: string[];
}

export interface PayOrderPixInput {
  orderId: string;
}

export interface PayOrderCreditInput {
  orderId: string;
  card: PagBankCardData;
  installments: number;
  capture: boolean;
  holderName: string;
  holderTaxId: string;
}

export interface PayOrderDebitInput {
  orderId: string;
  card: PagBankCardData;
  holderName: string;
  holderTaxId: string;
}

export interface PayOrderBoletoInput {
  orderId: string;
  dueDate: string; // YYYY-MM-DD
  holderName: string;
  holderTaxId: string;
  holderEmail: string;
  holderAddress: PagBankAddress;
}

// ---------- Helpers ----------

const pagbankApi = axios.create({
  baseURL: env.pagBankBaseUrl || "https://sandbox.api.pagseguro.com",
  headers: {
    Authorization: `Bearer ${env.pagBankToken}`,
    "Content-Type": "application/json",
    "x-api-version": "4.0",
  },
});

function cleanAddress(addr: PagBankAddress) {
  return {
    street: addr.street,
    number: addr.number,
    complement: addr.complement || undefined,
    locality: addr.locality,
    city: addr.city,
    region_code: addr.region_code,
    country: addr.country || "BRA",
    postal_code: addr.postal_code,
  };
}

// ---------- Create Order (without payment) ----------

export async function createPagBankOrder(input: CreateOrderInput) {
  const payload: any = {
    reference_id: input.referenceId,
    customer: input.customer,
    items: input.items,
    shipping: input.shippingAddress
      ? { address: cleanAddress(input.shippingAddress) }
      : undefined,
  };

  if (input.notificationUrls && input.notificationUrls.length > 0) {
    payload.notification_urls = input.notificationUrls;
  }

  try {
    const response = await pagbankApi.post("/orders", payload);
    return response.data;
  } catch (error: any) {
    console.error(
      "[PagBank] createOrder error:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.error_messages?.[0]?.description ||
        error.message ||
        "Erro ao criar pedido no PagBank"
    );
  }
}

// ---------- Pay with PIX ----------

export async function payWithPix(orderId: string, amount: number) {
  const payload = {
    charges: [
      {
        reference_id: `charge_${Date.now()}`,
        description: "Pagamento via PIX",
        amount: { value: amount, currency: "BRL" },
        payment_method: {
          type: "PIX",
        },
      },
    ],
  };

  try {
    const response = await pagbankApi.post(`/orders/${orderId}/pay`, payload);
    return response.data;
  } catch (error: any) {
    console.error(
      "[PagBank] payWithPix error:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.error_messages?.[0]?.description ||
        "Erro ao processar pagamento PIX"
    );
  }
}

// ---------- Pay with Credit Card ----------

export async function payWithCreditCard(
  orderId: string,
  amount: number,
  card: PagBankCardData,
  installments: number,
  capture: boolean,
  holderName: string,
  holderTaxId: string
) {
  const payload = {
    charges: [
      {
        reference_id: `charge_${Date.now()}`,
        description: "Pagamento com cartão de crédito",
        amount: { value: amount, currency: "BRL" },
        payment_method: {
          type: "CREDIT_CARD",
          installments,
          capture,
          card: {
            number: card.number.replace(/\s/g, ""),
            exp_month: card.exp_month,
            exp_year: card.exp_year,
            security_code: card.security_code,
            holder: { name: holderName },
          },
        },
      },
    ],
  };

  try {
    const response = await pagbankApi.post(`/orders/${orderId}/pay`, payload);
    return response.data;
  } catch (error: any) {
    console.error(
      "[PagBank] payWithCreditCard error:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.error_messages?.[0]?.description ||
        "Erro ao processar pagamento com cartão de crédito"
    );
  }
}

// ---------- Pay with Debit Card ----------

export async function payWithDebitCard(
  orderId: string,
  amount: number,
  card: PagBankCardData,
  holderName: string,
  holderTaxId: string
) {
  const payload = {
    charges: [
      {
        reference_id: `charge_${Date.now()}`,
        description: "Pagamento com cartão de débito",
        amount: { value: amount, currency: "BRL" },
        payment_method: {
          type: "DEBIT_CARD",
          card: {
            number: card.number.replace(/\s/g, ""),
            exp_month: card.exp_month,
            exp_year: card.exp_year,
            security_code: card.security_code,
            holder: { name: holderName },
          },
        },
      },
    ],
  };

  try {
    const response = await pagbankApi.post(`/orders/${orderId}/pay`, payload);
    return response.data;
  } catch (error: any) {
    console.error(
      "[PagBank] payWithDebitCard error:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.error_messages?.[0]?.description ||
        "Erro ao processar pagamento com cartão de débito"
    );
  }
}

// ---------- Pay with Boleto ----------

export async function payWithBoleto(
  orderId: string,
  amount: number,
  dueDate: string,
  holderName: string,
  holderTaxId: string,
  holderEmail: string,
  holderAddress: PagBankAddress
) {
  const payload = {
    charges: [
      {
        reference_id: `charge_${Date.now()}`,
        description: "Pagamento via boleto",
        amount: { value: amount, currency: "BRL" },
        payment_method: {
          type: "BOLETO",
          boleto: {
            due_date: dueDate,
            instruction_lines: {
              line_1: "Pagamento referente ao aluguel de ferramentas",
              line_2: "Via AlugaTools",
            },
            holder: {
              name: holderName,
              tax_id: holderTaxId.replace(/\D/g, ""),
              email: holderEmail,
              address: cleanAddress(holderAddress),
            },
          },
        },
      },
    ],
  };

  try {
    const response = await pagbankApi.post(`/orders/${orderId}/pay`, payload);
    return response.data;
  } catch (error: any) {
    console.error(
      "[PagBank] payWithBoleto error:",
      error.response?.data || error.message
    );
    throw new Error(
      error.response?.data?.error_messages?.[0]?.description ||
        "Erro ao processar pagamento com boleto"
    );
  }
}

// ---------- Legacy compat (kept for backward compat) ----------

interface ChargeInput {
  amount: number;
  description: string;
  referenceId: string;
}

export async function createPagBankCharge(input: ChargeInput) {
  console.warn(
    "[PagBank] createPagBankCharge is deprecated. Use createPagBankOrder + payWith* instead."
  );
  // Return a no-op for backward compat - the new flow uses createPagBankOrder + pay
  return { deprecated: true, message: "Use new order flow" };
}
