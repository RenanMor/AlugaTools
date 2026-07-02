/**
 * Teste de login com CPF e CNPJ — AlugaTools API
 * Roda com: node backend/test-auth.js
 */

const BASE_URL = "https://alugatools-api.onrender.com";

async function apiPost(path, body) {
  const url = `${BASE_URL}${path}`;
  console.log(`\n→ POST ${url}`);
  console.log("  Payload:", JSON.stringify(body, null, 2));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  console.log(`  Status: ${res.status}`);
  console.log("  Response:", JSON.stringify(json, null, 2));
  return { status: res.status, json };
}

async function testCPFLogin() {
  console.log("\n════════════════════════════════════════");
  console.log("TESTE 1 — Login com CPF (Sou Cliente)");
  console.log("════════════════════════════════════════");

  const cpf = "37322650808";

  const result = await apiPost("/api/auth/signin", {
    cpf,
    password: "123456",
    profile: "customer",
  });

  if (result.status === 200 || result.status === 201) {
    console.log("  ✅ Login com CPF FUNCIONOU");
    console.log("  Usuário:", result.json.user?.name, "| Profile:", result.json.user?.profile);
  } else if (result.status === 401 && result.json.error?.includes("Documento não cadastrado")) {
    console.log("  ⚠️  CPF não cadastrado no banco (esperado se não há usuário com esse CPF)");
    console.log("  Erro:", result.json.error?.substring(0, 150));
  } else {
    console.log("  ❌ Erro inesperado:", result.json.error);
  }
}

async function testCNPJLogin() {
  console.log("\n════════════════════════════════════════");
  console.log("TESTE 2 — Login com CNPJ (Sou Empresa)");
  console.log("════════════════════════════════════════");

  const cnpj = "30273903000107";

  const result = await apiPost("/api/auth/signin", {
    cnpj,
    password: "123456",
    profile: "company",
  });

  if (result.status === 200 || result.status === 201) {
    console.log("  ✅ Login com CNPJ FUNCIONOU");
    console.log("  Usuário:", result.json.user?.name, "| Profile:", result.json.user?.profile);
  } else if (result.status === 401 && result.json.error?.includes("Documento não cadastrado")) {
    console.log("  ⚠️  CNPJ não cadastrado no banco (esperado se não há usuário com esse CNPJ)");
    console.log("  Erro:", result.json.error?.substring(0, 150));
  } else {
    console.log("  ❌ Erro inesperado:", result.json.error);
  }
}

async function testWrongPassword() {
  console.log("\n════════════════════════════════════════");
  console.log("TESTE 3 — Senha errada (deve rejeitar)");
  console.log("════════════════════════════════════════");

  const result = await apiPost("/api/auth/signin", {
    email: "nao_existe@teste.com",
    password: "senhaerrada",
    profile: "customer",
  });

  if (result.status === 401 || result.status === 400) {
    console.log("  ✅ Credenciais inválidas rejeitadas. Status:", result.status);
  } else {
    console.log("  ❌ Resposta inesperada:", result.status, result.json);
  }
}

async function testMissingDocument() {
  console.log("\n════════════════════════════════════════");
  console.log("TESTE 4 — Sem documento nem email (deve rejeitar)");
  console.log("════════════════════════════════════════");

  const result = await apiPost("/api/auth/signin", {
    password: "123456",
    profile: "company",
  });

  if (result.status === 400) {
    console.log("  ✅ Rejeitado corretamente. Erro:", result.json.error);
  } else {
    console.log("  ❌ Resposta inesperada:", result.status, result.json);
  }
}

async function testDiagnoseBankContent() {
  console.log("\n════════════════════════════════════════");
  console.log("TESTE 5 — Diagnóstico: usuários cadastrados no banco");
  console.log("════════════════════════════════════════");

  const result = await apiPost("/api/auth/signin", {
    cpf: "00000000000",
    password: "123456",
    profile: "customer",
  });

  if (result.json.error?.includes("Buscado:")) {
    console.log("  📋 Documentos cadastrados no banco:");
    const match = result.json.error.match(/Banco: \[(.*)\]/s);
    if (match) {
      const entries = match[1].split(" | ");
      entries.forEach(e => console.log("    •", e));
    } else {
      console.log("  Erro completo:", result.json.error?.substring(0, 300));
    }
  } else {
    console.log("  Erro:", result.json.error?.substring(0, 200));
  }
}

(async () => {
  console.log(`\n🔧 AlugaTools — Teste de Autenticação (CPF / CNPJ)`);
  console.log(`🌐 API: ${BASE_URL}\n`);

  try {
    await testCPFLogin();
    await testCNPJLogin();
    await testWrongPassword();
    await testMissingDocument();
    await testDiagnoseBankContent();

    console.log("\n════════════════════════════════════════");
    console.log("✅ Todos os testes concluídos");
    console.log("════════════════════════════════════════\n");
  } catch (err) {
    console.error("\n💥 Erro fatal:", err.message);
  }
})();
