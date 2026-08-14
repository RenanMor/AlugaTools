/**
 * Payment Gateway Router
 *
 * Decides which gateway to use based on the order total:
 * - Pagar.me → for orders <= threshold (default R$200)
 * - Asaas    → for orders > threshold
 *
 * Exception: Debit card payments always use Pagar.me regardless of amount,
 * because Asaas doesn't support direct debit card processing via API.
 */

import { env } from "../config/env";
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

// ---------- Types ----------

export type PaymentGateway = "pagarme" | "asaas";

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
  paymentMethod: "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
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
  exp_month: string;
  exp_year: string;
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
  invoiceUrl?: string | null;
  authenticationUrl?: string | null;
  rawResponse: any;
}

// ---------- Gateway Selection ----------

/**
 * Determine which gateway to use.
 * - DEBIT_CARD → always Pagar.me (Asaas doesn't support direct debit)
 * - <= threshold → Pagar.me
 * - > threshold → Asaas
 */
export function selectGateway(
  totalPrice: number,
  paymentMethod: string
): PaymentGateway {
  // Debit card always goes to Pagar.me
  if (paymentMethod === "DEBIT_CARD") {
    return "pagarme";
  }

  const threshold = env.paymentGatewayThreshold;
  return totalPrice <= threshold ? "pagarme" : "asaas";
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

  if (gateway === "pagarme") {
    return processPagarme(rental, user, cardData, installments);
  } else {
    return processAsaas(rental, user, cardData, installments);
  }
}

// ---------- Pagar.me Processing ----------

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

    const isPaid = result.status === "paid" || result.status === "overpaid";

    return {
      gateway: "pagarme",
      paymentId: result.orderId,
      status: normalizeStatus(result.status, "pagarme"),
      isPaid,
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

    const isPaid = result.status === "paid" || result.status === "overpaid";

    return {
      gateway: "pagarme",
      paymentId: result.orderId,
      status: normalizeStatus(result.status, "pagarme"),
      isPaid,
      authenticationUrl: result.authenticationUrl,
      rawResponse: result.rawResponse,
    };
  }

  throw new Error(`Método de pagamento inválido: ${rental.paymentMethod}`);
}

// ---------- Asaas Processing ----------

async function processAsaas(
  rental: PaymentRentalData,
  user: PaymentUserData,
  cardData?: PaymentCardInput,
  installments?: number
): Promise<PaymentResult> {
  const cleanCpf = user.cpf.replace(/\D/g, "");
  const cleanPhone = `${user.phoneArea}${user.phoneNumber}`;

  // Step 1: Find or create customer in Asaas
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
        expiryMonth: cardData.exp_month,
        expiryYear: cardData.exp_year,
        ccv: cardData.security_code,
      },
      cardHolderInfo: holderInfo,
      installmentCount: installments || 1,
    });

    const isPaid =
      result.status === "CONFIRMED" || result.status === "RECEIVED";

    return {
      gateway: "asaas",
      paymentId: result.paymentId,
      status: normalizeStatus(result.status, "asaas"),
      isPaid,
      invoiceUrl: result.invoiceUrl,
      rawResponse: result.rawResponse,
    };
  }

  // DEBIT_CARD should never reach Asaas (forced to Pagar.me in selectGateway),
  // but handle gracefully just in case
  throw new Error(
    "Cartão de débito não é suportado pelo Asaas. Use Pagar.me."
  );
}

// ---------- Helpers ----------

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
  const number = a.number || "0";
  const street = a.street || "Rua Não Informada";
  const neighborhood = a.neighborhood || "Centro";

  return {
    line_1: `${number}, ${street}, ${neighborhood}`,
    line_2: a.complement || undefined,
    zip_code: (a.cep || "").replace(/\D/g, "") || "01001000",
    city: a.city || "São Paulo",
    state: (a.state || "SP").substring(0, 2).toUpperCase(),
    country: "BR",
  };
}

/**
 * Normalize status from either gateway to a common format.
 */
function normalizeStatus(
  status: string,
  gateway: PaymentGateway
): string {
  if (gateway === "pagarme") {
    // Pagar.me statuses: pending, paid, canceled, failed, overpaid
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
    // Asaas statuses: PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, etc.
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
