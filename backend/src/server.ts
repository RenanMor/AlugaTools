import { createApp } from "./app";
import { env } from "./config/env";
import { supabaseAdmin } from "./config/supabase";

const app = createApp();

app.listen(env.port, async () => {
  console.log(`AlugaTools API running on port ${env.port}`);
  try {
    const { data, error } = await supabaseAdmin.from("users").select("id, name, email, cpf, cnpj, profile");
    console.log("[DEBUG-DB] Current users in DB:", JSON.stringify(data, null, 2));
    if (error) console.error("[DEBUG-DB] Error listing users:", error);
  } catch (err) {
    console.error("[DEBUG-DB] Error querying users:", err);
  }
});
