import axios, { AxiosInstance } from "axios";
import { env } from "../config/env";

// ---------- Types ----------

export interface AsaasCustomerInput {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string;
}

export interface AsaasCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface AsaasCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  phone: string;
}

// ---------- API Client ----------

function createAsaasClient(): AxiosInstance {
  return axios.create({
    baseURL: env.asaasBaseUrl || "https://api-sandbox.asaas.com/v3",
    headers: {
      access_token: env.asaasApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
}

// ---------- Customer Management ----------

/**
 * Find an existing Asaas customer by CPF/CNPJ, or create a new one.
 * Asaas requires a customer to be created before creating charges.
 */
export async function findOrCreateAsaasCustomer(
  input: AsaasCustomerInput
): Promise<string> {
  const api = createAsaasClient();
  const cleanDoc = input.cpfCnpj.replace(/\D/g, "");

  try {
    // First, try to find existing customer by CPF/CNPJ
    const searchResponse = await api.get("/customers", {
      params: { cpfCnpj: cleanDoc },
    });

    const existingCustomers = searchResponse.data?.data || [];
    if (existingCustomers.length > 0) {
      return existingCustomers[0].id;
    }

    // Create new customer
    const createResponse = await api.post("/customers", {
      name: input.name,
      email: input.email,
      cpfCnpj: cleanDoc,
      phone: input.phone || undefined,
      mobilePhone: input.mobilePhone || undefined,
      externalReference: input.externalReference || undefined,
    });

    return createResponse.data.id;
  } catch (error: any) {
    console.error(
      "[Asaas] findOrCreateCustomer error:",
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    const errorMsg =
      error.response?.data?.errors?.[0]?.description ||
      error.message ||
      "Erro ao criar/buscar cliente no Asaas";
    throw new Error(errorMsg);
  }
}

// ---------- PIX Payment ----------

export async function asaasPayPix(input: {
  customerId: string;
  value: number; // in BRL (e.g. 150.50)
  description: string;
  externalReference: string;
  dueDate: string; // YYYY-MM-DD
}) {
  const api = createAsaasClient();

  try {
    // Step 1: Create the charge
    const chargeResponse = await api.post("/payments", {
      customer: input.customerId,
      billingType: "PIX",
      value: input.value,
      description: input.description,
      externalReference: input.externalReference,
      dueDate: input.dueDate,
    });

    const charge = chargeResponse.data;

    // Step 2: Get PIX QR Code
    let pixData = null;
    try {
      const pixResponse = await api.get(`/payments/${charge.id}/pixQrCode`);
      pixData = pixResponse.data;
    } catch (pixError: any) {
      console.warn(
        "[Asaas] pixQrCode fetch warning (may need payment confirmation first):",
        pixError.response?.data || pixError.message
      );
    }

    return {
      paymentId: charge.id,
      status: charge.status || "PENDING",
      pixQrCode: pixData?.encodedImage || null,
      pixCopyPaste: pixData?.payload || null,
      pixExpirationDate: pixData?.expirationDate || null,
      invoiceUrl: charge.invoiceUrl || null,
      rawResponse: charge,
    };
  } catch (error: any) {
    console.error(
      "[Asaas] payPix error:",
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    const errorMsg =
      error.response?.data?.errors?.[0]?.description ||
      error.message ||
      "Erro ao processar pagamento PIX via Asaas";
    throw new Error(errorMsg);
  }
}

// ---------- Credit Card Payment ----------

export async function asaasPayCreditCard(input: {
  customerId: string;
  value: number; // in BRL
  description: string;
  externalReference: string;
  dueDate: string;
  card: AsaasCardData;
  cardHolderInfo: AsaasCardHolderInfo;
  installmentCount?: number;
}) {
  const api = createAsaasClient();

  try {
    const payload: any = {
      customer: input.customerId,
      billingType: "CREDIT_CARD",
      value: input.value,
      description: input.description,
      externalReference: input.externalReference,
      dueDate: input.dueDate,
      creditCard: {
        holderName: input.card.holderName,
        number: input.card.number.replace(/\s/g, ""),
        expiryMonth: input.card.expiryMonth,
        expiryYear: input.card.expiryYear,
        ccv: input.card.ccv,
      },
      creditCardHolderInfo: {
        name: input.cardHolderInfo.name,
        email: input.cardHolderInfo.email,
        cpfCnpj: input.cardHolderInfo.cpfCnpj.replace(/\D/g, ""),
        postalCode: input.cardHolderInfo.postalCode.replace(/\D/g, ""),
        addressNumber: input.cardHolderInfo.addressNumber,
        phone: input.cardHolderInfo.phone.replace(/\D/g, ""),
      },
    };

    if (input.installmentCount && input.installmentCount > 1) {
      payload.installmentCount = input.installmentCount;
      payload.installmentValue = Number(
        (input.value / input.installmentCount).toFixed(2)
      );
    }

    const response = await api.post("/payments", payload);
    const charge = response.data;

    return {
      paymentId: charge.id,
      status: charge.status || "PENDING",
      confirmedDate: charge.confirmedDate || null,
      invoiceUrl: charge.invoiceUrl || null,
      rawResponse: charge,
    };
  } catch (error: any) {
    console.error(
      "[Asaas] payCreditCard error:",
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    const errorMsg =
      error.response?.data?.errors?.[0]?.description ||
      error.message ||
      "Erro ao processar pagamento com cartão de crédito via Asaas";
    throw new Error(errorMsg);
  }
}

// ---------- Debit Card Payment (via invoice URL redirect) ----------

/**
 * Asaas does not support direct debit card processing via API.
 * We create a charge with UNDEFINED billing type and return the invoiceUrl
 * so the customer can choose debit on the Asaas hosted checkout page.
 *
 * NOTE: In practice, debit card payments are always routed to Pagar.me
 * by the payment-gateway router, regardless of amount. This function
 * exists as a fallback.
 */
export async function asaasPayDebitCard(input: {
  customerId: string;
  value: number;
  description: string;
  externalReference: string;
  dueDate: string;
}) {
  const api = createAsaasClient();

  try {
    const response = await api.post("/payments", {
      customer: input.customerId,
      billingType: "UNDEFINED", // Let customer choose on checkout page
      value: input.value,
      description: input.description,
      externalReference: input.externalReference,
      dueDate: input.dueDate,
    });

    const charge = response.data;

    return {
      paymentId: charge.id,
      status: charge.status || "PENDING",
      invoiceUrl: charge.invoiceUrl || null,
      rawResponse: charge,
    };
  } catch (error: any) {
    console.error(
      "[Asaas] payDebitCard error:",
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    const errorMsg =
      error.response?.data?.errors?.[0]?.description ||
      error.message ||
      "Erro ao processar pagamento com cartão de débito via Asaas";
    throw new Error(errorMsg);
  }
}

// ---------- Get Payment Status ----------

export async function getAsaasPaymentStatus(paymentId: string) {
  const api = createAsaasClient();

  try {
    const response = await api.get(`/payments/${paymentId}`);
    const payment = response.data;

    const paidStatuses = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];
    const isPaid = paidStatuses.includes(payment.status);

    return { isPaid, status: payment.status, paymentData: payment };
  } catch (error: any) {
    console.error(
      "[Asaas] getPaymentStatus error:",
      error.response?.status || error.message
    );
    return { isPaid: false, status: "error", paymentData: null };
  }
}
