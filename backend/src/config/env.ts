import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || "development",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  // Asaas (Primary Gateway — Split de Pagamentos)
  asaasApiKey: process.env.ASAAS_API_KEY || "",
  asaasBaseUrl: process.env.ASAAS_BASE_URL || (process.env.NODE_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3"),
  platformFeePercent: Number(process.env.PLATFORM_FEE_PERCENT) || 20, // % retido pela plataforma (default 20%)

  // Inactive / Fallback Gateways
  mercadoPagoAccessToken: (process.env.MERCADO_PAGO_ACCESS_TOKEN || "").trim(),
  mercadoPagoPublicKey: (process.env.MERCADO_PAGO_PUBLIC_KEY || "").trim(),
  mercadoPagoBaseUrl: (process.env.MERCADO_PAGO_BASE_URL || "https://api.mercadopago.com").trim(),
  pagarmeSecretKey: process.env.PAGARME_SECRET_KEY || "",
  pagarmeBaseUrl: process.env.PAGARME_BASE_URL || "https://api.pagar.me/core/v5",

  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 100,
};
