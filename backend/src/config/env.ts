import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || "development",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  pagBankToken: process.env.PAGBANK_TOKEN || "",
  pagBankBaseUrl: process.env.PAGBANK_BASE_URL || "",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 100,
};
