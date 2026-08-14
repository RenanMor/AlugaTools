import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || "development",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",

  // Pagar.me (used for orders <= threshold)
  pagarmeSecretKey: process.env.PAGARME_SECRET_KEY || "",
  pagarmeBaseUrl: process.env.PAGARME_BASE_URL || "https://api.pagar.me/core/v5",

  // Asaas (used for orders > threshold)
  asaasApiKey: process.env.ASAAS_API_KEY || "",
  asaasBaseUrl: process.env.ASAAS_BASE_URL || (process.env.NODE_ENV === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3"),

  // Gateway routing threshold in BRL (default R$200)
  paymentGatewayThreshold: Number(process.env.PAYMENT_GATEWAY_THRESHOLD) || 200,

  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 100,
};
