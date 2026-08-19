/**
 * Payment Gateway Router
 *
 * Primary Active Gateway:
 * - Mercado Pago (Checkout API / Orders / Preferences)
 *   Supports: PIX, Credit Card, Debit Card, Saldo Mercado Pago (Wallet)
 *
 * Inactive / Disabled Gateways (Kept for fallback/historical reference):
 * - Pagar.me V5 (orders <= R$200)
 * - Asaas v3 (orders > R$200)
 */

import { env } from "../config/env";
import {
  mercadopagoPayPix,
  mercadopagoPayCreditCard,
  mercadopagoPayDebitCard,
  mercadopagoPayWallet,
  MercadoPagoPayer,
} from "./mercadopago";

// Inactive gateways kept for reference/fallback
import {
  pagarmePayPix,
  pagarmePayCreditCard,
  pagarmePayDebitCard,
  PagarmeCustomer,
  PagarmeItem,
  PagarmeAddress,
} from "./pagarme";
import {
  findOrCreateAsaasCustomer,
  asaasPayPix,
  asaasPayCreditCard,
  AsaasCardData,
  AsaasCardHolderInfo,
} from "./asaas";

// ---------- Configuration ----------

export type PaymentGateway = "mercadopago" | "pagarme" | "asaas";

/**
 * Active gateway switch.
 * Set to "mercadopago" as the primary active gateway.
 */
export const ACTIVE_GATEWAY: PaymentGateway = "mercadopago";

// ---------- Types ----------

export interface PaymentUserData {
  id: string;
  name: string;
  email: string;
  cpf: string; // cleaned (digits only)
  phoneArea: string;
  phoneNumber: string;
}

export interface PaymentRentalData {
  id: string;
  totalPrice: number; // in BRL
  paymentMethod: "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "MERCADO_PAGO_WALLET";
  toolName: string;
  toolId: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    cep?: string;
  };
}

export interface PaymentCardInput {
  number: string;
  holder_name: string;
  exp_month: string | number;
  exp_year: string | number;
  security_code: string;
  holder?: { name: string };
}

export interface PaymentResult {
  gateway: PaymentGateway;
  paymentId: string;
  status: string;
  isPaid: boolean;
  pixQrCode?: string | null;
  pixCopyPaste?: string | null;
  pixExpirationDate?: string | null;
  ticketUrl?: string | null;
  invoiceUrl?: string | null;
  authenticationUrl?: string | null;
  rawResponse: any;
}

// ---------- Gateway Selection ----------

/**
 * Determine which gateway to use.
 * Returns "mercadopago" as primary.
 */
export function selectGateway(
  _totalPrice: number,
  _paymentMethod: string
): PaymentGateway {
  return ACTIVE_GATEWAY;
}

// ---------- Unified Payment Processor ----------

export async function processPayment(
  rental: PaymentRentalData,
  user: PaymentUserData,
  cardData?: PaymentCardInput,
  installments?: number
): Promise<PaymentResult> {
  const gateway = selectGateway(rental.totalPrice, rental.paymentMethod);

  console.log(
    `[PaymentGateway] Routing rental ${rental.id} (R$${rental.totalPrice}, method: ${rental.paymentMethod}) → ${gateway.toUpperCase()}`
  );

  if (gateway === "mercadopago") {
    return processMercadoPago(rental, user, cardData, installments);
  }

  // Fallbacks if ever re-enabled:
  if (gateway === "pagarme") {
    return processPagarme(rental, user, cardData, installments);
  } else {
    return processAsaas(rental, user, cardData, installments);
  }
}

// ============================================================
// 1. Mercado Pago Processing (ACTIVE PRIMARY)
// ============================================================

async function processMercadoPago(
  rental: PaymentRentalData,
  user: PaymentUserData,
  cardData?: PaymentCardInput,
  installments?: number
): Promise<PaymentResult> {
  const cleanCpf = user.cpf.replace(/\D/g, "");
  const nameParts = (user.name || "Cliente AlugaTools").trim().split(/\s+/);
  const firstName = nameParts[0] || "Cliente";
  const lastName = nameParts.slice(1).join(" ") || "AlugaTools";

  const addr = rental.address || {};
  const payer: MercadoPagoPayer = {
    email: user.email,
    first_name: firstName,
    last_name: lastName,
    identification: {
      type: cleanCpf.length === 14 ? "CNPJ" : "CPF",
      number: cleanCpf,
    },
    address: {
      zip_code: (addr.cep || "").replace(/\D/g, "") || "01001000",
      street_name: addr.street || "Rua",
      street_number: Number(addr.number) || 0,
      neighborhood: addr.neighborhood || "Centro",
      city: addr.city || "São Paulo",
      federal_unit: (addr.state || "SP").substring(0, 2).toUpperCase(),
    },
    phone: {
      area_code: user.phoneArea || "11",
      number: user.phoneNumber || "999999999",
    },
  };

  const referenceId = `rental_${rental.id}`;
  const description = `Aluguel: ${rental.toolName || "Ferramenta"} (#${rental.id.slice(0, 8)})`;

  // --- A. PIX ---
  if (rental.paymentMethod === "PIX") {
    const result = await mercadopagoPayPix({
      referenceId,
      amount: rental.totalPrice,
      description,
      payer,
    });

    // When generating a PIX order, it is in pending state awaiting customer payment
    return {
      gateway: "mercadopago",
      paymentId: result.paymentId,
      status: "PENDING",
      isPaid: false,
      pixQrCode: result.pixQrCode,
      pixCopyPaste: result.pixCopyPaste,
      ticketUrl: result.ticketUrl,
      rawResponse: result.rawResponse,
    };
  }

  // --- B. Cartão de Crédito ---
  if (rental.paymentMethod === "CREDIT_CARD") {
    if (!cardData) throw new Error("Dados do cartão de crédito ausentes");

    const result = await mercadopagoPayCreditCard({
      referenceId,
      amount: rental.totalPrice,
      description,
      card: {
        number: cardData.number,
        holder_name: cardData.holder_name || cardData.holder?.name || user.name,
        exp_month: cardData.exp_month,
        exp_year: cardData.exp_year,
        security_code: cardData.security_code,
      },
      installments: installments || 1,
      payer,
    });

    return {
      gateway: "mercadopago",
      paymentId: result.paymentId,
      status: normalizeStatus(result.status, "mercadopago"),
      isPaid: result.isApproved,
      rawResponse: result.rawResponse,
    };
  }

  // --- C. Cartão de Débito ---
  if (rental.paymentMethod === "DEBIT_CARD") {
    if (!cardData) throw new Error("Dados do cartão de débito ausentes");

    const result = await mercadopagoPayDebitCard({
      referenceId,
      amount: rental.totalPrice,
      description,
      card: {
        number: cardData.number,
        holder_name: cardData.holder_name || cardData.holder?.name || user.name,
        exp_month: cardData.exp_month,
        exp_year: cardData.exp_year,
        security_code: cardData.security_code,
      },
      payer,
    });

    return {
      gateway: "mercadopago",
      paymentId: result.paymentId,
      status: normalizeStatus(result.status, "mercadopago"),
      isPaid: result.isApproved,
      authenticationUrl: result.authenticationUrl,
      rawResponse: result.rawResponse,
    };
  }

  // --- D. Saldo Mercado Pago / Conta Mercado Pago (Wallet) ---
  if (rental.paymentMethod === "MERCADO_PAGO_WALLET") {
    const result = await mercadopagoPayWallet({
      referenceId,
      items: [
        {
          id: rental.toolId,
          title: rental.toolName || "Aluguel de Ferramenta",
          quantity: 1,
          unit_price: rental.totalPrice,
        },
      ],
      payer,
    });

    return {
      gateway: "mercadopago",
      paymentId: result.preferenceId,
      status: "PENDING",
      isPaid: false,
      invoiceUrl: result.initPoint,
      rawResponse: result.rawResponse,
    };
  }

  throw new Error(`Método de pagamento inválido: ${rental.paymentMethod}`);
}

// ============================================================
// 2. Pagar.me Processing (INACTIVE / DISABLED)
// ============================================================

async function processPagarme(
  rental: PaymentRentalData,
  user: PaymentUserData,
  cardData?: PaymentCardInput,
  installments?: number
): Promise<PaymentResult> {
  const cleanCpf = user.cpf.replace(/\D/g, "");

  const customer: PagarmeCustomer = {
    name: ensureFullName(user.name),
    email: user.email,
    document: cleanCpf,
    document_type: cleanCpf.length === 14 ? "CNPJ" : "CPF",
    type: cleanCpf.length === 14 ? "company" : "individual",
    phones: {
      mobile_phone: {
        country_code: "55",
        area_code: user.phoneArea,
        number: user.phoneNumber,
      },
    },
  };

  const items: PagarmeItem[] = [
    {
      amount: Math.round(rental.totalPrice * 100),
      description: rental.toolName || "Aluguel de Ferramenta",
      quantity: 1,
      code: rental.toolId,
    },
  ];

  const referenceId = `rental_${rental.id}`;

  if (rental.paymentMethod === "PIX") {
    const result = await pagarmePayPix({
      referenceId,
      customer,
      items,
      amountCents: Math.round(rental.totalPrice * 100),
    });

    return {
      gateway: "pagarme",
      paymentId: result.orderId,
      status: normalizeStatus(result.status, "pagarme"),
      isPaid: result.status === "paid",
      pixQrCode: result.pixQrCode,
      pixCopyPaste: result.pixCopyPaste,
      rawResponse: result.rawResponse,
    };
  }

  if (rental.paymentMethod === "CREDIT_CARD") {
    if (!cardData) throw new Error("Dados do cartão de crédito ausentes");
    const billingAddress = buildPagarmeBillingAddress(rental.address);

    const result = await pagarmePayCreditCard({
      referenceId,
      customer,
      items,
      amountCents: Math.round(rental.totalPrice * 100),
      card: {
        number: cardData.number,
        holder_name: cardData.holder_name || cardData.holder?.name || user.name,
        exp_month: Number(cardData.exp_month),
        exp_year: Number(cardData.exp_year),
        cvv: cardData.security_code,
      },
      installments: installments || 1,
      billingAddress,
    });

    return {
      gateway: "pagarme",
      paymentId: result.orderId,
      status: normalizeStatus(result.status, "pagarme"),
      isPaid: result.status === "paid" || result.status === "overpaid",
      rawResponse: result.rawResponse,
    };
  }

  if (rental.paymentMethod === "DEBIT_CARD") {
    if (!cardData) throw new Error("Dados do cartão de débito ausentes");
    const billingAddress = buildPagarmeBillingAddress(rental.address);

    const result = await pagarmePayDebitCard({
      referenceId,
      customer,
      items,
      amountCents: Math.round(rental.totalPrice * 100),
      card: {
        number: cardData.number,
        holder_name: cardData.holder_name || cardData.holder?.name || user.name,
        exp_month: Number(cardData.exp_month),
        exp_year: Number(cardData.exp_year),
        cvv: cardData.security_code,
      },
      billingAddress,
    });

    return {
      gateway: "pagarme",
      paymentId: result.orderId,
      status: normalizeStatus(result.status, "pagarme"),
      isPaid: result.status === "paid" || result.status === "overpaid",
      authenticationUrl: result.authenticationUrl,
      rawResponse: result.rawResponse,
    };
  }

  throw new Error(`Método não suportado pelo Pagar.me: ${rental.paymentMethod}`);
}

// ============================================================
// 3. Asaas Processing (INACTIVE / DISABLED)
// ============================================================

async function processAsaas(
  rental: PaymentRentalData,
  user: PaymentUserData,
  cardData?: PaymentCardInput,
  installments?: number
): Promise<PaymentResult> {
  const cleanCpf = user.cpf.replace(/\D/g, "");
  const cleanPhone = `${user.phoneArea}${user.phoneNumber}`;

  const asaasCustomerId = await findOrCreateAsaasCustomer({
    name: ensureFullName(user.name),
    email: user.email,
    cpfCnpj: cleanCpf,
    mobilePhone: cleanPhone,
    externalReference: user.id,
  });

  const externalReference = `rental_${rental.id}`;
  const dueDate = getTomorrowDate();

  if (rental.paymentMethod === "PIX") {
    const result = await asaasPayPix({
      customerId: asaasCustomerId,
      value: rental.totalPrice,
      description: `Aluguel: ${rental.toolName || "Ferramenta"}`,
      externalReference,
      dueDate,
    });

    return {
      gateway: "asaas",
      paymentId: result.paymentId,
      status: normalizeStatus(result.status, "asaas"),
      isPaid: result.status === "CONFIRMED" || result.status === "RECEIVED",
      pixQrCode: result.pixQrCode,
      pixCopyPaste: result.pixCopyPaste,
      pixExpirationDate: result.pixExpirationDate,
      invoiceUrl: result.invoiceUrl,
      rawResponse: result.rawResponse,
    };
  }

  if (rental.paymentMethod === "CREDIT_CARD") {
    if (!cardData) throw new Error("Dados do cartão de crédito ausentes");

    const addr = rental.address || {};
    const holderInfo: AsaasCardHolderInfo = {
      name: cardData.holder_name || cardData.holder?.name || user.name,
      email: user.email,
      cpfCnpj: cleanCpf,
      postalCode: (addr.cep || "").replace(/\D/g, "") || "01001000",
      addressNumber: addr.number || "0",
      phone: cleanPhone,
    };

    const result = await asaasPayCreditCard({
      customerId: asaasCustomerId,
      value: rental.totalPrice,
      description: `Aluguel: ${rental.toolName || "Ferramenta"}`,
      externalReference,
      dueDate,
      card: {
        holderName: cardData.holder_name || cardData.holder?.name || user.name,
        number: cardData.number,
        expiryMonth: String(cardData.exp_month),
        expiryYear: String(cardData.exp_year),
        ccv: cardData.security_code,
      },
      cardHolderInfo: holderInfo,
      installmentCount: installments || 1,
    });

    return {
      gateway: "asaas",
      paymentId: result.paymentId,
      status: normalizeStatus(result.status, "asaas"),
      isPaid: result.status === "CONFIRMED" || result.status === "RECEIVED",
      invoiceUrl: result.invoiceUrl,
      rawResponse: result.rawResponse,
    };
  }

  throw new Error("Método não suportado pelo Asaas");
}

// ============================================================
// Helpers
// ============================================================

function ensureFullName(name: string): string {
  const trimmed = (name || "").trim();
  if (trimmed.split(/\s+/).length >= 2) return trimmed;
  return `${trimmed} Silva`;
}

function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().substring(0, 10);
}

function buildPagarmeBillingAddress(
  addr?: PaymentRentalData["address"]
): PagarmeAddress {
  const a = addr || {};
  return {
    line_1: `${a.number || "0"}, ${a.street || "Rua"}, ${a.neighborhood || "Centro"}`,
    line_2: a.complement || undefined,
    zip_code: (a.cep || "").replace(/\D/g, "") || "01001000",
    city: a.city || "São Paulo",
    state: (a.state || "SP").substring(0, 2).toUpperCase(),
    country: "BR",
  };
}

/**
 * Normalize status from any gateway to a common format.
 */
function normalizeStatus(
  status: string,
  gateway: PaymentGateway
): string {
  if (gateway === "mercadopago") {
    // Orders API statuses: processed, created, pending, cancelled, failed
    // Payments API statuses (legacy): approved, pending, rejected, cancelled, refunded
    switch (status?.toLowerCase()) {
      case "processed":
      case "approved":
      case "paid":
        return "PAID";
      case "created":
      case "pending":
      case "in_process":
      case "authorized":
        return "PENDING";
      case "cancelled":
      case "refunded":
      case "charged_back":
        return "CANCELLED";
      case "failed":
      case "rejected":
        return "DECLINED";
      default:
        return "PENDING";
    }
  }

  if (gateway === "pagarme") {
    switch (status?.toLowerCase()) {
      case "paid":
      case "overpaid":
        return "PAID";
      case "pending":
      case "processing":
        return "PENDING";
      case "canceled":
      case "cancelled":
        return "CANCELLED";
      case "failed":
        return "DECLINED";
      default:
        return "PENDING";
    }
  }

  if (gateway === "asaas") {
    switch (status?.toUpperCase()) {
      case "CONFIRMED":
      case "RECEIVED":
      case "RECEIVED_IN_CASH":
        return "PAID";
      case "PENDING":
      case "AWAITING_RISK_ANALYSIS":
        return "PENDING";
      case "OVERDUE":
      case "REFUNDED":
      case "CHARGEBACK_REQUESTED":
      case "CHARGEBACK_DISPUTE":
        return "CANCELLED";
      case "REFUND_REQUESTED":
        return "REFUNDING";
      default:
        return "PENDING";
    }
  }

  return "PENDING";
}
