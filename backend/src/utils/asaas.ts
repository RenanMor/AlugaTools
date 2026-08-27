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

export interface AsaasSplitItem {
  walletId: string;
  fixedValue?: number;
  percentualValue?: number;
}

export interface AsaasSubaccountInput {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
  phone?: string;
  address?: string;
  addressNumber?: string;
  province?: string;
  postalCode?: string;
  companyType?: "MEI" | "LIMITED" | "INDIVIDUAL" | "ASSOCIATION";
}

export interface AsaasSubaccountResult {
  accountId: string;
  walletId: string;
  apiKey: string;
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

// ============================================================
// Subaccount Management (for marketplace Split)
// ============================================================

/**
 * Create an Asaas subaccount for a company.
 * This is required for Split — each company receiving split payments
 * must have their own Asaas account with a walletId.
 *
 * Docs: https://docs.asaas.com/reference/criar-subconta
 */
export async function createAsaasSubaccount(
  input: AsaasSubaccountInput
): Promise<AsaasSubaccountResult> {
  const api = createAsaasClient();

  const cleanDoc = input.cpfCnpj.replace(/\D/g, "");

  const payload: any = {
    name: input.name,
    email: input.email,
    cpfCnpj: cleanDoc,
    mobilePhone: input.mobilePhone || undefined,
    phone: input.phone || undefined,
    address: input.address || undefined,
    addressNumber: input.addressNumber || undefined,
    province: input.province || undefined,
    postalCode: input.postalCode ? input.postalCode.replace(/\D/g, "") : undefined,
    companyType: input.companyType || (cleanDoc.length === 14 ? "LIMITED" : "MEI"),
  };

  try {
    const response = await api.post("/accounts", payload);
    const account = response.data;

    console.log(
      `[Asaas] Subaccount created: ${account.id} (walletId: ${account.walletId})`
    );

    return {
      accountId: account.id,
      walletId: account.walletId,
      apiKey: account.apiKey || "",
    };
  } catch (error: any) {
    console.error(
      "[Asaas] createSubaccount error:",
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    const errorMsg =
      error.response?.data?.errors?.[0]?.description ||
      error.message ||
      "Erro ao criar subconta Asaas para a empresa";
    throw new Error(errorMsg);
  }
}

/**
 * Retrieve the walletId for a given Asaas account.
 * Used when the company already has an Asaas account but we don't have the walletId.
 *
 * Docs: https://docs.asaas.com/reference/recuperar-walletid
 */
export async function getAsaasWalletId(accountApiKey: string): Promise<string> {
  try {
    const api = axios.create({
      baseURL: env.asaasBaseUrl || "https://api-sandbox.asaas.com/v3",
      headers: {
        access_token: accountApiKey,
        "Content-Type": "application/json",
      },
    });

    const response = await api.get("/finance/getCurrentBalance");
    // The walletId can also be retrieved from /myAccount
    const balanceData = response.data;
    
    // Alternative: use /wallets endpoint
    const walletResponse = await api.get("/myAccount");
    return walletResponse.data.walletId || "";
  } catch (error: any) {
    console.error("[Asaas] getWalletId error:", error.response?.data || error.message);
    throw new Error("Erro ao recuperar walletId da conta Asaas");
  }
}

// ============================================================
// Customer Management
// ============================================================

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

// ============================================================
// PIX Payment (with Split support)
// ============================================================

export async function asaasPayPix(input: {
  customerId: string;
  value: number; // in BRL (e.g. 150.50)
  description: string;
  externalReference: string;
  dueDate: string; // YYYY-MM-DD
  split?: AsaasSplitItem[];
}) {
  const api = createAsaasClient();

  try {
    // Build charge payload
    const payload: any = {
      customer: input.customerId,
      billingType: "PIX",
      value: input.value,
      description: input.description,
      externalReference: input.externalReference,
      dueDate: input.dueDate,
    };

    // Add split configuration if provided
    if (input.split && input.split.length > 0) {
      payload.split = input.split.map((s) => ({
        walletId: s.walletId,
        ...(s.fixedValue !== undefined ? { fixedValue: s.fixedValue } : {}),
        ...(s.percentualValue !== undefined ? { percentualValue: s.percentualValue } : {}),
      }));
      console.log(`[Asaas] PIX charge with Split: ${JSON.stringify(payload.split)}`);
    }

    // Step 1: Create the charge
    const chargeResponse = await api.post("/payments", payload);
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

// ============================================================
// Credit Card Payment (with Split support)
// ============================================================

export async function asaasPayCreditCard(input: {
  customerId: string;
  value: number; // in BRL
  description: string;
  externalReference: string;
  dueDate: string;
  card: AsaasCardData;
  cardHolderInfo: AsaasCardHolderInfo;
  installmentCount?: number;
  split?: AsaasSplitItem[];
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

    // Add split configuration if provided
    if (input.split && input.split.length > 0) {
      payload.split = input.split.map((s) => ({
        walletId: s.walletId,
        ...(s.fixedValue !== undefined ? { fixedValue: s.fixedValue } : {}),
        ...(s.percentualValue !== undefined ? { percentualValue: s.percentualValue } : {}),
      }));
      console.log(`[Asaas] Credit card charge with Split: ${JSON.stringify(payload.split)}`);
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

// ============================================================
// Debit Card Payment (via invoice URL redirect, with Split support)
// ============================================================

/**
 * Asaas does not support direct debit card processing via API.
 * We create a charge with UNDEFINED billing type and return the invoiceUrl
 * so the customer can choose debit on the Asaas hosted checkout page.
 *
 * Split is still supported — it's applied when the payment is confirmed
 * regardless of the billing type chosen by the customer on the checkout page.
 */
export async function asaasPayDebitCard(input: {
  customerId: string;
  value: number;
  description: string;
  externalReference: string;
  dueDate: string;
  split?: AsaasSplitItem[];
}) {
  const api = createAsaasClient();

  try {
    const payload: any = {
      customer: input.customerId,
      billingType: "UNDEFINED", // Let customer choose on checkout page
      value: input.value,
      description: input.description,
      externalReference: input.externalReference,
      dueDate: input.dueDate,
    };

    // Add split configuration if provided
    if (input.split && input.split.length > 0) {
      payload.split = input.split.map((s) => ({
        walletId: s.walletId,
        ...(s.fixedValue !== undefined ? { fixedValue: s.fixedValue } : {}),
        ...(s.percentualValue !== undefined ? { percentualValue: s.percentualValue } : {}),
      }));
      console.log(`[Asaas] Debit/UNDEFINED charge with Split: ${JSON.stringify(payload.split)}`);
    }

    const response = await api.post("/payments", payload);
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

// ============================================================
// Get Payment Status
// ============================================================

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

// ============================================================
// Split Helpers
// ============================================================

/**
 * Build the split array for a charge.
 * Calculates the company's share based on platform fee percentage.
 *
 * @param companyWalletId - The Asaas walletId of the company receiving the split
 * @param platformFeePercent - The percentage the platform keeps (e.g. 20 means platform keeps 20%)
 * @returns Split configuration array for the Asaas charge payload
 */
export function buildSplitConfig(
  companyWalletId: string,
  platformFeePercent: number
): AsaasSplitItem[] {
  if (!companyWalletId) {
    console.warn("[Asaas] No walletId provided — split will not be applied");
    return [];
  }

  // The company receives (100 - platformFee)% of the netValue
  // The platform keeps the rest automatically (no need to specify)
  const companyPercent = Math.max(0, Math.min(100, 100 - platformFeePercent));

  if (companyPercent <= 0) {
    console.warn("[Asaas] Company share is 0% — no split needed");
    return [];
  }

  return [
    {
      walletId: companyWalletId,
      percentualValue: Number(companyPercent.toFixed(4)),
    },
  ];
}

// ============================================================
// Pix Key Validation (DICT - Banco Central)
// ============================================================

export interface AsaasPixKeyValidationResult {
  valid: boolean;
  name?: string;
  cpfCnpj?: string;
  ispb?: string;
  endToEndId?: string;
  errorMessage?: string;
}

/**
 * Validates a Pix key directly against Banco Central's DICT via Asaas API.
 * Returns account holder information if valid.
 *
 * Docs: https://docs.asaas.com/reference/consultar-chave-pix
 */
export async function validateAsaasPixKey(
  type: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP",
  key: string
): Promise<AsaasPixKeyValidationResult> {
  const api = createAsaasClient();
  const cleanKey = type === "CPF" || type === "CNPJ" || type === "PHONE" 
    ? key.replace(/\D/g, "") 
    : key.trim();

  try {
    const response = await api.get("/pix/addressKeys/external", {
      params: { type, key: cleanKey },
    });

    const data = response.data;
    return {
      valid: true,
      name: data.name || data.ownerName,
      cpfCnpj: data.cpfCnpj,
      ispb: data.ispb,
      endToEndId: data.endToEndId,
    };
  } catch (error: any) {
    console.warn("[Asaas] validatePixKey warning:", error.response?.data || error.message);
    const desc = error.response?.data?.errors?.[0]?.description || error.message || "Chave Pix não encontrada no Banco Central";
    return {
      valid: false,
      errorMessage: desc,
    };
  }
}

// ============================================================
// Subaccount Payout / Transfer to Traditional Bank
// ============================================================

export interface AsaasTransferInput {
  value: number;
  description?: string;
  // Option A: Transfer to Pix Key
  pixAddressKey?: string;
  pixAddressKeyType?: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
  // Option B: Transfer to Traditional Bank Account (TED/Pix)
  bankAccount?: {
    bank: { code: string };
    ownerName: string;
    cpfCnpj: string;
    agency: string;
    account: string;
    accountDigit: string;
    bankAccountType: "CONTA_CORRENTE" | "CONTA_POUPANCA";
  };
}

/**
 * Transfers funds from a Subaccount to an external bank account or Pix key.
 * Uses the subaccount's individual API key.
 *
 * Docs: https://docs.asaas.com/reference/transferir-para-conta-de-outra-instituicao-ou-chave-pix
 */
export async function transferSubaccountFunds(
  subaccountApiKey: string,
  input: AsaasTransferInput
) {
  if (!subaccountApiKey) {
    throw new Error("API Key da subconta não fornecida para transferência");
  }

  const api = axios.create({
    baseURL: env.asaasBaseUrl || "https://api-sandbox.asaas.com/v3",
    headers: {
      access_token: subaccountApiKey,
      "Content-Type": "application/json",
    },
  });

  const payload: any = {
    value: input.value,
    description: input.description || "Repasse de aluguel AlugaTools",
  };

  if (input.pixAddressKey && input.pixAddressKeyType) {
    payload.pixAddressKey = input.pixAddressKey;
    payload.pixAddressKeyType = input.pixAddressKeyType;
  } else if (input.bankAccount) {
    payload.bankAccount = {
      bank: { code: input.bankAccount.bank.code },
      ownerName: input.bankAccount.ownerName,
      cpfCnpj: input.bankAccount.cpfCnpj.replace(/\D/g, ""),
      agency: input.bankAccount.agency,
      account: input.bankAccount.account,
      accountDigit: input.bankAccount.accountDigit,
      bankAccountType: input.bankAccount.bankAccountType,
    };
  } else {
    throw new Error("Informe uma chave Pix ou dados bancários para transferência");
  }

  try {
    const response = await api.post("/transfers", payload);
    return response.data;
  } catch (error: any) {
    console.error(
      "[Asaas] transferSubaccountFunds error:",
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    const errorMsg =
      error.response?.data?.errors?.[0]?.description ||
      error.message ||
      "Erro ao realizar transferência a partir da subconta";
    throw new Error(errorMsg);
  }
}

