require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase.from("users").select("id, name, email, cpf, cnpj, profile");
  console.log(JSON.stringify({ data, error }, null, 2));
}
main();
