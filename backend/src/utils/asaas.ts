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
  notificationDisabled?: boolean;
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
  incomeValue?: number;
}

export interface AsaasSubaccountResult {
  accountId: string;
  walletId: string;
  apiKey: string;
}

// ---------- API Client ----------

/**
 * Normalizes the Asaas Base URL.
 * Automatically fixes common configuration mistakes:
 * - Omitting /v3 (e.g. https://api-sandbox.asaas.com -> https://api-sandbox.asaas.com/v3)
 * - Trailing slashes
 * - Using dashboard hostname (sandbox.asaas.com -> api-sandbox.asaas.com)
 * - Defaults according to NODE_ENV
 */
export function getAsaasBaseUrl(): string {
  let url = (env.asaasBaseUrl || "").trim();

  if (!url) {
    url = env.nodeEnv === "production"
      ? "https://api.asaas.com/v3"
      : "https://api-sandbox.asaas.com/v3";
  }

  // Remove trailing slashes
  url = url.replace(/\/+$/, "");

  // If Sandbox is detected in the URL
  if (url.includes("sandbox")) {
    // Normalizes all sandbox variations:
    // "https://sandbox.asaas.com", "https://sandbox.asaas.com/api", "https://sandbox.asaas.com/api/v3", "https://api-sandbox.asaas.com"
    return "https://api-sandbox.asaas.com/v3";
  }

  // If Production is detected
  if (url.includes("asaas.com")) {
    return "https://api.asaas.com/v3";
  }

  // Custom proxy / self-hosted gateway fallback
  if (!url.endsWith("/v3")) {
    url = `${url}/v3`;
  }

  return url;
}

function createAsaasClient(accountApiKey?: string): AxiosInstance {
  const baseURL = getAsaasBaseUrl();
  const token = (accountApiKey || env.asaasApiKey || "").trim();

  return axios.create({
    baseURL,
    headers: {
      access_token: token,
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
  const cleanPostalCode = (input.postalCode || "").replace(/\D/g, "") || "01001000";
  const cleanPhone = (input.mobilePhone || input.phone || "11999999999").replace(/\D/g, "");

  const payload: any = {
    name: input.name,
    email: input.email,
    cpfCnpj: cleanDoc,
    mobilePhone: cleanPhone,
    phone: cleanPhone,
    address: input.address || "Rua Principal",
    addressNumber: input.addressNumber || "100",
    province: input.province || "Centro",
    postalCode: cleanPostalCode,
    companyType: input.companyType || (cleanDoc.length === 14 ? "LIMITED" : "MEI"),
    incomeValue: input.incomeValue || 5000,
  };

  try {
    console.log(`[Asaas] Creating subaccount via POST ${getAsaasBaseUrl()}/accounts for doc: ${cleanDoc.slice(0, 4)}*** (CEP: ${cleanPostalCode})`);
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
    const requestedUrl = `${error.config?.baseURL || ""}${error.config?.url || ""}`;
    const status = error.response?.status;
    const responseData = error.response?.data;

    console.error(
      `[Asaas] createSubaccount error [${status}] on ${requestedUrl}:`,
      JSON.stringify(responseData || error.message, null, 2)
    );

    const errorMsg =
      responseData?.errors?.[0]?.description ||
      responseData?.message ||
      (status === 404
        ? `Endpoint Asaas não encontrado (404 em ${requestedUrl}). Verifique se a variável ASAAS_BASE_URL no Render está configurada como 'https://api-sandbox.asaas.com/v3'`
        : null) ||
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
    const api = createAsaasClient(accountApiKey);
    const walletResponse = await api.get("/myAccount");
    return walletResponse.data.walletId || "";
  } catch (error: any) {
    console.error("[Asaas] getWalletId error:", error.response?.data || error.message);
    throw new Error("Erro ao recuperar walletId da conta Asaas");
  }
}

// ============================================================
// Customer Management (Docs: https://docs.asaas.com/docs/criando-um-cliente)
// ============================================================

/**
 * Find an existing Asaas customer by CPF/CNPJ or externalReference, or create a new one.
 * Follows the official Asaas guidelines to prevent duplicate customer records.
 *
 * Docs: https://docs.asaas.com/docs/criando-um-cliente
 * Endpoint: POST /v3/customers
 */
export async function findOrCreateAsaasCustomer(
  input: AsaasCustomerInput
): Promise<string> {
  const api = createAsaasClient();
  const cleanDoc = input.cpfCnpj.replace(/\D/g, "");

  try {
    // 1. Try to find existing customer by CPF/CNPJ
    if (cleanDoc) {
      const searchResponse = await api.get("/customers", {
        params: { cpfCnpj: cleanDoc },
      });

      const existingCustomers = searchResponse.data?.data || [];
      if (existingCustomers.length > 0) {
        return existingCustomers[0].id;
      }
    }

    // 2. Try to find by externalReference (app user ID) as recommended by Asaas
    if (input.externalReference) {
      const refSearch = await api.get("/customers", {
        params: { externalReference: input.externalReference },
      });

      const existingByRef = refSearch.data?.data || [];
      if (existingByRef.length > 0) {
        return existingByRef[0].id;
      }
    }

    // 3. Create new customer if not found
    const payload: any = {
      name: input.name,
      email: input.email,
      cpfCnpj: cleanDoc,
      phone: input.phone || undefined,
      mobilePhone: input.mobilePhone || undefined,
      externalReference: input.externalReference || undefined,
      notificationDisabled: input.notificationDisabled ?? false,
    };

    const createResponse = await api.post("/customers", payload);
    return createResponse.data.id;
  } catch (error: any) {
    console.error(
      "[Asaas] findOrCreateCustomer error:",
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    const errorMsg =
      error.response?.data?.errors?.[0]?.description ||
      error.response?.data?.message ||
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
  bankName?: string;
  cpfCnpj?: string;
  ispb?: string;
  endToEndId?: string;
  errorMessage?: string;
}

export const ISPB_BANK_MAP: Record<string, string> = {
  "00000000": "Banco do Brasil",
  "00360305": "Caixa Econômica",
  "60701190": "Itaú Unibanco",
  "60746948": "Banco Bradesco",
  "90400888": "Banco Santander",
  "18236120": "Nubank",
  "10573521": "Mercado Pago",
  "07450604": "Banco Inter",
  "22896431": "PicPay",
  "33657248": "C6 Bank",
  "00000208": "Banco BRB",
  "00416968": "Banco Safra",
  "02038232": "Banco Original",
  "17184037": "Banco Mercantil",
  "28195667": "Neon",
  "30306294": "BTG Pactual",
  "38031548": "PagBank",
  "46563938": "Asaas",
};

/**
 * Validates a Pix key directly against Banco Central's DICT via Asaas API.
 * Returns account holder and bank/PSP information if valid.
 *
 * Docs: https://docs.asaas.com/reference/consultar-chave-pix
 */
export async function validateAsaasPixKey(
  type: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP",
  key: string,
  fallback?: { ownerName?: string; companyName?: string }
): Promise<AsaasPixKeyValidationResult> {
  const api = createAsaasClient();
  const cleanKey = type === "CPF" || type === "CNPJ" || type === "PHONE" 
    ? key.replace(/\D/g, "") 
    : key.trim();

  const isSandbox = getAsaasBaseUrl().includes("sandbox");

  try {
    const response = await api.get("/pix/addressKeys/external", {
      params: { type, key: cleanKey },
    });

    const data = response.data || {};
    console.log("[Asaas DICT] Full response:", JSON.stringify(data));

    // Asaas can return the holder name in many different structures
    // depending on API version and key type. We cover all known variants:
    const holderName =
      data.name ||
      data.ownerName ||
      data.holderName ||
      data.accountHolderName ||
      data.accountHolder?.name ||
      data.holder?.name ||
      data.pixHolder?.name ||
      data.account?.name ||
      data.owner?.name ||
      // Sometimes the name comes wrapped in a "customer" object
      data.customer?.name ||
      // Some versions return as "naturalPerson.name" or "legalPerson.tradeName"
      data.naturalPerson?.name ||
      data.legalPerson?.tradeName ||
      data.legalPerson?.companyName ||
      // Fallback to ownerName passed by the caller (from the registration form)
      fallback?.ownerName?.trim() ||
      fallback?.companyName?.trim() ||
      "Titular Confirmado";

    const ispb = data.ispb || data.accountHolder?.ispb || data.holder?.ispb;
    const bankName =
      data.participantName ||
      data.bankName ||
      data.institution ||
      data.institutionName ||
      (ispb ? ISPB_BANK_MAP[ispb] : null) ||
      "Banco Participante";

    console.log(`[Asaas DICT] Resolved -> name: "${holderName}", bank: "${bankName}"`);

    return {
      valid: true,
      name: holderName,
      bankName: bankName,
      cpfCnpj: data.cpfCnpj,
      ispb: ispb,
      endToEndId: data.endToEndId,
    };
  } catch (error: any) {
    console.warn("[Asaas] validatePixKey warning:", error.response?.data || error.message);

    // No Sandbox do Asaas, apenas a chave mock 47996515839 existe no DICT de teste.
    // Para qualquer outra chave testada em Sandbox (404), resolvemos o nome real do proprietário/empresa:
    if (isSandbox && error.response?.status === 404) {
      console.log(`[Asaas Sandbox] Resolvendo titular para chave de teste (${type}: ${cleanKey})`);

      let resolvedName = fallback?.ownerName?.trim() || fallback?.companyName?.trim();

      // Se for CNPJ real e não tiver nome, tenta buscar a razão social oficial na Receita Federal via BrasilAPI
      if (!resolvedName && type === "CNPJ" && cleanKey.length === 14) {
        try {
          const cnpjRes = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cleanKey}`, { timeout: 3000 });
          if (cnpjRes.data?.razao_social || cnpjRes.data?.nome_fantasia) {
            resolvedName = cnpjRes.data.razao_social || cnpjRes.data.nome_fantasia;
          }
        } catch {
          // Silent fallback
        }
      }

      // Se for E-mail (ex: joao.silva@email.com), formata como nome próprio
      if (!resolvedName && type === "EMAIL") {
        const userPart = cleanKey.split("@")[0].replace(/[._-]/g, " ");
        resolvedName = userPart
          .split(" ")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
      }

      if (!resolvedName) {
        resolvedName = fallback?.companyName || fallback?.ownerName || "Titular da Conta";
      }

      return {
        valid: true,
        name: resolvedName,
        bankName: "Mercado Pago",
        cpfCnpj: cleanKey,
      };
    }

    const desc = error.response?.data?.errors?.[0]?.description 
      || (error.response?.status === 404 ? "Chave Pix não encontrada no Banco Central" : null)
      || error.message 
      || "Chave Pix não encontrada no Banco Central";

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

  const api = createAsaasClient(subaccountApiKey);

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

// ============================================================
// Subaccount Balance Query
// ============================================================

export interface AsaasBalance {
  balance: number;
  availableBalance: number;
  pendingBalance: number;
}

/**
 * Queries the current balance of an Asaas subaccount.
 * Uses the subaccount's individual API key.
 *
 * Docs: https://docs.asaas.com/reference/recuperar-saldo-da-conta
 */
export async function getSubaccountBalance(
  subaccountApiKey: string
): Promise<AsaasBalance> {
  if (!subaccountApiKey) {
    throw new Error("API Key da subconta não fornecida para consulta de saldo");
  }

  const api = createAsaasClient(subaccountApiKey);

  try {
    const response = await api.get("/finance/getCurrentBalance");
    const data = response.data;
    return {
      balance: Number(data.totalBalance ?? data.balance ?? 0),
      availableBalance: Number(data.availableBalance ?? data.balance ?? 0),
      pendingBalance: Number(data.pendingBalance ?? 0),
    };
  } catch (error: any) {
    console.error(
      "[Asaas] getSubaccountBalance error:",
      JSON.stringify(error.response?.data || error.message, null, 2)
    );
    const errorMsg =
      error.response?.data?.errors?.[0]?.description ||
      error.message ||
      "Erro ao consultar saldo da subconta";
    throw new Error(errorMsg);
  }
}


