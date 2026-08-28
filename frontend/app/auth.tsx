import { router, useLocalSearchParams } from "expo-router";
import { useState, useEffect, useRef } from "react";
import { Pressable, Text, TextInput, View, ScrollView, ActivityIndicator } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { ProfileType } from "@/lib/types";
import { lookupCep } from "@/lib/api/rentals";
import { validatePixKey } from "@/lib/api/companies";

type PaymentMethod = "pix" | "ted";
type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

function validateCPF(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]+/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

function validateCNPJ(cnpj: string): boolean {
  cnpj = cnpj.replace(/[^\d]+/g, "");
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  let size = cnpj.length - 2;
  let numbers = cnpj.substring(0, size);
  const digits = cnpj.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;

  size = size + 1;
  numbers = cnpj.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;

  return true;
}

export default function AuthScreen() {
  const colors = useColors();
  const { login, checkout, cart, logout } = useApp();
  const params = useLocalSearchParams<{ intent?: string }>();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [profile, setProfile] = useState<ProfileType>("customer");
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  // Address fields (company onboarding)
  const [postalCode, setPostalCode] = useState("");
  const [addressStreet, setAddressStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  // Payment method (company onboarding)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>("EMAIL");
  const [pixKey, setPixKey] = useState("");
  const [pixValidating, setPixValidating] = useState(false);
  const [pixValidated, setPixValidated] = useState(false);
  const [pixHolderName, setPixHolderName] = useState("");
  const [pixBankName, setPixBankName] = useState("");
  const [pixError, setPixError] = useState("");
  // TED fields
  const [bankCode, setBankCode] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountDigit, setBankAccountDigit] = useState("");
  const [bankAccountType, setBankAccountType] = useState<"CONTA_CORRENTE" | "CONTA_POUPANCA">("CONTA_CORRENTE");
  const [bankOwnerName, setBankOwnerName] = useState("");
  const [bankCpfCnpj, setBankCpfCnpj] = useState("");

  const [loading, setLoading] = useState(false);
  const [companyApprovalStatus, setCompanyApprovalStatus] = useState<"pending" | "rejected" | null>(null);


  const handleCpfChange = (val: string) => {
    const cleaned = val.replace(/\D/g, "");
    const limited = cleaned.slice(0, 11);

    let formatted = limited;
    if (limited.length > 9) {
      formatted = `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9, 11)}`;
    } else if (limited.length > 6) {
      formatted = `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
    } else if (limited.length > 3) {
      formatted = `${limited.slice(0, 3)}.${limited.slice(3)}`;
    }
    setCpf(formatted);
  };

  const handleCnpjChange = (val: string) => {
    const cleaned = val.replace(/\D/g, "");
    const limited = cleaned.slice(0, 14);

    let formatted = limited;
    if (limited.length > 12) {
      formatted = `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8, 12)}-${limited.slice(12, 14)}`;
    } else if (limited.length > 8) {
      formatted = `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8)}`;
    } else if (limited.length > 5) {
      formatted = `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5)}`;
    } else if (limited.length > 2) {
      formatted = `${limited.slice(0, 2)}.${limited.slice(2)}`;
    }
    setCnpj(formatted);
  };

  const handlePhoneChange = (val: string) => {
    const cleaned = val.replace(/\D/g, "");
    const limited = cleaned.slice(0, 11);

    let formatted = limited;
    if (limited.length > 6) {
      formatted = `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
    } else if (limited.length > 2) {
      formatted = `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
    }
    setPhone(formatted);
  };

  const handleCepChange = async (val: string) => {
    const cleaned = val.replace(/\D/g, "").slice(0, 8);
    const formatted = cleaned.length > 5 ? `${cleaned.slice(0, 5)}-${cleaned.slice(5)}` : cleaned;
    setPostalCode(formatted);

    if (cleaned.length === 8) {
      setCepLoading(true);
      try {
        const data = await lookupCep(cleaned);
        console.log("[CEP Lookup] Response:", data);
        if (data) {
          const street = data.street || data.logradouro || "";
          const neigh = data.neighborhood || data.bairro || "";
          const cty = data.city || data.localidade || "";
          const uf = data.state || data.uf || "";

          if (street) setAddressStreet(street);
          if (neigh) setNeighborhood(neigh);
          if (cty) setCity(cty);
          if (uf) setState(uf);
        }
      } catch (err: any) {
        console.warn("[CEP Lookup] Failed:", err.message);
      } finally {
        setCepLoading(false);
      }
    }
  };

  // Minimum key lengths per type for triggering validation
  const PIX_MIN_LENGTH: Record<string, number> = {
    CPF: 11,
    CNPJ: 14,
    EMAIL: 6,
    PHONE: 10,
    EVP: 32,
  };

  // Debounce Pix validation: triggers 800ms after user stops typing
  const pixDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePixKeyChange = (val: string) => {
    setPixKey(val);
    setPixValidated(false);
    setPixHolderName("");
    setPixError("");

    // Cancel any pending validation
    if (pixDebounceRef.current) clearTimeout(pixDebounceRef.current);

    const cleanVal = val.trim().replace(/\D/g, "");
    const minLen = PIX_MIN_LENGTH[pixKeyType] || 5;
    const useRaw = pixKeyType === "EMAIL" || pixKeyType === "EVP";
    const effectiveLen = useRaw ? val.trim().length : cleanVal.length;

    if (effectiveLen < minLen) return; // Not enough chars yet — wait

    setPixValidating(true);
    pixDebounceRef.current = setTimeout(async () => {
      try {
        const result = await validatePixKey(pixKeyType, val.trim(), {
          ownerName: ownerName.trim(),
          companyName: name.trim(),
        });
        console.log("[Frontend Pix Validation] Result:", JSON.stringify(result));
        if (result && result.valid) {
          const resolvedName = result.name || ownerName.trim() || name.trim() || "Titular Confirmado";
          setPixValidated(true);
          setPixHolderName(resolvedName);
          setPixBankName(result.bankName || "Mercado Pago");
          setPixError("");
        } else {
          setPixValidated(false);
          setPixHolderName("");
          setPixBankName("");
          setPixError(result?.errorMessage || "Chave Pix não encontrada no Banco Central");
        }
      } catch (err: any) {
        setPixValidated(false);
        setPixHolderName("");
        setPixBankName("");
        setPixError(err.message || "Erro ao validar chave Pix");
      } finally {
        setPixValidating(false);
      }
    }, 800);
  };

  // Reset Pix state when key type changes
  useEffect(() => {
    setPixKey("");
    setPixValidated(false);
    setPixHolderName("");
    setPixBankName("");
    setPixError("");
    if (pixDebounceRef.current) clearTimeout(pixDebounceRef.current);
  }, [pixKeyType]);

  const submit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (mode === "register") {
        if (profile === "deliverer") {
          alert("Cadastro de entregador deve ser realizado pela empresa parceira.");
          setLoading(false);
          return;
        }

        if (profile === "company") {
          const cleanCnpj = cnpj.replace(/\D/g, "");
          if (!cleanCnpj) { alert("CNPJ é obrigatório para empresas"); setLoading(false); return; }
          if (!validateCNPJ(cleanCnpj)) { alert("CNPJ inválido. Digite um CNPJ real."); setLoading(false); return; }
          if (!postalCode.replace(/\D/g, "")) { alert("CEP é obrigatório para empresas"); setLoading(false); return; }
          if (!addressNumber.trim()) { alert("Número do endereço é obrigatório"); setLoading(false); return; }
          if (!state.trim() || !city.trim()) { alert("Estado e Cidade são obrigatórios para empresas"); setLoading(false); return; }

          if (paymentMethod === "pix") {
            if (!pixKey.trim()) { alert("Informe a chave Pix"); setLoading(false); return; }
            if (!pixValidated) { alert("Por favor, valide sua chave Pix antes de continuar"); setLoading(false); return; }
          } else {
            if (!bankCode.trim() || !bankAgency.trim() || !bankAccount.trim() || !bankOwnerName.trim() || !bankCpfCnpj.trim()) {
              alert("Preencha todos os dados bancários para TED"); setLoading(false); return;
            }
          }
        } else {
          const cleanCpf = cpf.replace(/\D/g, "");
          if (!cleanCpf) {
            alert("CPF é obrigatório para clientes");
            setLoading(false);
            return;
          }
          if (!validateCPF(cleanCpf)) {
            alert("CPF inválido. Digite um CPF real.");
            setLoading(false);
            return;
          }
        }

        const cleanPhone = phone.replace(/\D/g, "");
        if (!cleanPhone || cleanPhone.length < 10) {
          alert("Telefone inválido (deve conter DDD e o número)");
          setLoading(false);
          return;
        }

        if (!name.trim()) {
          alert(profile === "company" ? "Nome da empresa é obrigatório" : "Nome completo é obrigatório");
          setLoading(false);
          return;
        }

        if (profile === "company" && !ownerName.trim()) {
          alert("Nome do proprietario é obrigatório");
          setLoading(false);
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email.trim() || !emailRegex.test(email.trim())) {
          alert("E-mail inválido. Digite um e-mail válido.");
          setLoading(false);
          return;
        }

        if (!password || password.length < 6) {
          alert("A senha deve ter pelo menos 6 caracteres");
          setLoading(false);
          return;
        }

        if (password !== confirmPassword) {
          alert("A confirmação de senha não coincide com a senha preenchida");
          setLoading(false);
          return;
        }
      } else {
        // Mode: Login
        if (profile === "deliverer") {
          if (!email.trim()) {
            alert("E-mail é obrigatório para entrar");
            setLoading(false);
            return;
          }
        } else {
          const documentToLogin = (profile === "company" ? cnpj : cpf).replace(/\D/g, "");

          if (!documentToLogin && !email.trim()) {
            alert("E-mail, CPF ou CNPJ é obrigatório para entrar");
            setLoading(false);
            return;
          }

          const isCpf = documentToLogin.length === 11;
          const isCnpj = documentToLogin.length === 14;

          if (documentToLogin && !isCpf && !isCnpj) {
            alert("CPF ou CNPJ inválido. Digite 11 dígitos para CPF ou 14 para CNPJ.");
            setLoading(false);
            return;
          }
        }

        if (!password) {
          alert("Senha é obrigatória");
          setLoading(false);
          return;
        }
      }

      // If they used a document, figure out which one it is
      let loginCpf: string | undefined;
      let loginCnpj: string | undefined;

      if (mode === "login" && profile !== "deliverer") {
        const rawDoc = profile === "company" ? cnpj : cpf;
        const cleanDoc = rawDoc.replace(/\D/g, "");
        if (cleanDoc) {
          if (profile === "company") loginCnpj = cleanDoc;
          else loginCpf = cleanDoc;
        }
      } else if (mode === "register") {
        loginCpf = profile === "customer" ? cpf : undefined;
        loginCnpj = profile === "company" ? cnpj : undefined;
      }

      console.log("[Frontend Auth] Invoking login()", {
        email: email.trim(),
        profile,
        loginCpf,
        loginCnpj,
        isRegister: mode === "register"
      });

      const isCompanyRegister = profile === "company" && mode === "register";

      const returnedUser = await login(
        email.trim(),
        profile === "company" ? (ownerName.trim() || name.trim()) : (name.trim() || "Usuário"),
        profile,
        password,
        mode === "register",
        loginCpf,
        phone,
        loginCnpj,
        state.trim(),
        city.trim(),
        profile === "company" ? name.trim() : undefined,
        // Address
        isCompanyRegister ? (postalCode.replace(/\D/g, "") || undefined) : undefined,
        isCompanyRegister ? (addressStreet.trim() || undefined) : undefined,
        isCompanyRegister ? (addressNumber.trim() || undefined) : undefined,
        isCompanyRegister ? (neighborhood.trim() || undefined) : undefined,
        // Payment method
        isCompanyRegister && paymentMethod === "pix" ? pixKeyType : undefined,
        isCompanyRegister && paymentMethod === "pix" ? pixKey.trim() : undefined,
        isCompanyRegister && paymentMethod === "pix" ? (pixHolderName || undefined) : undefined,
        isCompanyRegister && paymentMethod === "ted" ? bankCode.trim() : undefined,
        isCompanyRegister && paymentMethod === "ted" ? bankAgency.trim() : undefined,
        isCompanyRegister && paymentMethod === "ted" ? bankAccount.trim() : undefined,
        isCompanyRegister && paymentMethod === "ted" ? bankAccountDigit.trim() : undefined,
        isCompanyRegister && paymentMethod === "ted" ? bankAccountType : undefined,
        isCompanyRegister && paymentMethod === "ted" ? bankOwnerName.trim() : undefined,
        isCompanyRegister && paymentMethod === "ted" ? bankCpfCnpj.replace(/\D/g, "") : undefined,
      );

      const actualProfile = returnedUser?.profile || profile;

      // Redirect Owner to dashboard-owner
      if (returnedUser?.isOwner) {
        router.dismiss();
        router.push("/dashboard-owner");
        return;
      }

      // Check Company Approval Status
      if (actualProfile === "company" && returnedUser?.companyStatus !== "approved") {
        setCompanyApprovalStatus(returnedUser?.companyStatus === "rejected" ? "rejected" : "pending");
        return;
      }

      if (params.intent === "checkout" && actualProfile === "customer" && cart.length > 0) {
        await checkout();
        router.dismiss();
        router.push("/orders");
        return;
      }

      router.dismiss();
      router.push("/profile");
    } catch (err: any) {
      alert(err.message || "Erro de autenticação. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

  if (companyApprovalStatus) {
    const isPending = companyApprovalStatus === "pending";
    return (
      <ScreenContainer edges={["top", "left", "right"]} className="p-5" style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", gap: 20, paddingHorizontal: 20 }}>
          <IconSymbol
            name={isPending ? "clock.fill" : "exclamationmark.triangle.fill"}
            size={64}
            color={isPending ? colors.primary : "#EF4444"}
          />
          <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, textAlign: "center" }}>
            {isPending ? "Aguardando Análise" : "Cadastro Recusado"}
          </Text>
          <Text style={{ fontSize: 15, color: colors.muted, textAlign: "center", lineHeight: 22 }}>
            {isPending
              ? "Sua empresa foi cadastrada com sucesso! Nossa equipe está analisando os dados. Você receberá uma notificação assim que for aprovada."
              : "Sua empresa foi recusada pelo administrador do sistema. Por favor, entre em contato com o administrador do sistema para mais informações."}
          </Text>
          <Pressable
            onPress={async () => {
              await logout();
              setCompanyApprovalStatus(null);
            }}
            style={({ pressed }) => [
              {
                backgroundColor: colors.primary,
                borderRadius: 12,
                paddingVertical: 14,
                paddingHorizontal: 24,
                alignItems: "center",
                marginTop: 10,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Voltar para o Login</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]} className="p-5">
      <Pressable onPress={() => router.dismiss()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, alignSelf: "flex-end" }]}>
        <IconSymbol name="xmark" size={24} color={colors.foreground} />
      </Pressable>

      <View style={{ marginTop: 12, gap: 6, marginBottom: 12 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>
          {mode === "login" ? "Entrar" : "Criar conta"}
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>
          {params.intent === "checkout"
            ? "Entre para finalizar seu aluguel"
            : "Acesse sua conta AlugaTools"}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
        <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
          <Segment label="Cliente" active={profile === "customer"} onPress={() => setProfile("customer")} />
          <Segment label="Empresa" active={profile === "company"} onPress={() => setProfile("company")} />
          {mode === "login" && (
            <Segment label="Entregador" active={profile === "deliverer"} onPress={() => { setProfile("deliverer"); setMode("login"); }} />
          )}
        </View>

        <View style={{ gap: 14, marginTop: 22 }}>
          {mode === "register" ? (
            <>
              {profile === "customer" ? (
                <>
                  <Input label="CPF" value={cpf} onChangeText={handleCpfChange} placeholder="000.000.000-00" keyboardType="number-pad" />
                  <Input
                    label="Nome completo"
                    value={name}
                    onChangeText={setName}
                    placeholder="Nome do titular do CPF"
                    editable={validateCPF(cpf.replace(/\D/g, ""))}
                  />
                </>
              ) : (
                <>
                  <Input label="CNPJ" value={cnpj} onChangeText={handleCnpjChange} placeholder="00.000.000/0000-00" keyboardType="number-pad" />
                  <Input
                    label="Nome da empresa"
                    value={name}
                    onChangeText={setName}
                    placeholder="Razão social ou nome fantasia"
                    editable={validateCNPJ(cnpj.replace(/\D/g, ""))}
                  />
                  <Input
                    label="Nome do proprietario"
                    value={ownerName}
                    onChangeText={setOwnerName}
                    placeholder="Nome do proprietario / responsável"
                    editable={validateCNPJ(cnpj.replace(/\D/g, ""))}
                  />

                  {/* ── Endereço ── */}
                  <SectionHeader label="Endereço da Empresa" />

                  <View style={{ gap: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>CEP</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <TextInput
                        value={postalCode}
                        onChangeText={handleCepChange}
                        placeholder="00000-000"
                        keyboardType="number-pad"
                        placeholderTextColor={colors.muted}
                        returnKeyType="done"
                        style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: colors.foreground, fontSize: 15 }}
                      />
                      {cepLoading && <ActivityIndicator size="small" color={colors.primary} />}
                    </View>
                  </View>

                  <Input label="Rua / Logradouro" value={addressStreet} onChangeText={setAddressStreet} placeholder="Preenchido pelo CEP" />
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Input label="Número" value={addressNumber} onChangeText={setAddressNumber} placeholder="Ex: 123" keyboardType="number-pad" />
                    </View>
                    <View style={{ flex: 2 }}>
                      <Input label="Bairro" value={neighborhood} onChangeText={setNeighborhood} placeholder="Preenchido pelo CEP" />
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ width: 70 }}>
                      <Input label="UF" value={state} onChangeText={setState} placeholder="SP" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Input label="Cidade" value={city} onChangeText={setCity} placeholder="Ex: Campinas" />
                    </View>
                  </View>

                  {/* ── Forma de Recebimento ── */}
                  <SectionHeader label="Forma de Recebimento" />

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {(["pix", "ted"] as PaymentMethod[]).map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => setPaymentMethod(m)}
                        style={{ flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center", backgroundColor: paymentMethod === m ? colors.primary : colors.surface, borderWidth: 1, borderColor: paymentMethod === m ? colors.primary : colors.border }}
                      >
                        <Text style={{ fontWeight: "700", fontSize: 13, color: paymentMethod === m ? "#fff" : colors.foreground }}>
                          {m === "pix" ? "Pix" : "TED / Conta"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {paymentMethod === "pix" ? (
                    <>
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Tipo da Chave Pix</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 2 }}>
                          {([
                            { value: "EMAIL" as PixKeyType, label: "E-mail" },
                            { value: "CPF" as PixKeyType, label: "CPF" },
                            { value: "CNPJ" as PixKeyType, label: "CNPJ" },
                            { value: "PHONE" as PixKeyType, label: "Telefone" },
                            { value: "EVP" as PixKeyType, label: "Aleatória" },
                          ]).map((t) => (
                            <Pressable
                              key={t.value}
                              onPress={() => { setPixKeyType(t.value); setPixKey(""); setPixValidated(false); setPixHolderName(""); setPixError(""); }}
                              style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: pixKeyType === t.value ? colors.primary : colors.surface, borderWidth: 1, borderColor: pixKeyType === t.value ? colors.primary : colors.border }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: "700", color: pixKeyType === t.value ? "#fff" : colors.foreground }}>{t.label}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </View>

                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Chave Pix</Text>

                        {/* Input com spinner inline à direita */}
                        <View style={{ position: "relative", justifyContent: "center" }}>
                          <TextInput
                            value={pixKey}
                            onChangeText={handlePixKeyChange}
                            placeholder={
                              pixKeyType === "EMAIL" ? "email@empresa.com" :
                              pixKeyType === "CPF" ? "000.000.000-00" :
                              pixKeyType === "CNPJ" ? "00.000.000/0000-00" :
                              pixKeyType === "PHONE" ? "+55 (00) 00000-0000" :
                              "Cole aqui a chave aleatória"
                            }
                            keyboardType={pixKeyType === "EMAIL" ? "email-address" : "default"}
                            autoCapitalize="none"
                            autoCorrect={false}
                            placeholderTextColor={colors.muted}
                            returnKeyType="done"
                            style={{
                              backgroundColor: pixValidated ? "#16a34a18" : pixError ? "#dc262610" : colors.surface,
                              borderWidth: 1.5,
                              borderColor: pixValidated ? "#16a34a" : pixError ? "#dc2626" : pixValidating ? colors.primary : colors.border,
                              borderRadius: 12,
                              paddingHorizontal: 14,
                              paddingVertical: 13,
                              paddingRight: 44,
                              color: colors.foreground,
                              fontSize: 15,
                            }}
                          />
                          {/* Ícone de status à direita do campo */}
                          <View style={{ position: "absolute", right: 12, alignItems: "center", justifyContent: "center" }}>
                            {pixValidating ? (
                              <ActivityIndicator size="small" color={colors.primary} />
                            ) : pixValidated ? (
                              <IconSymbol name="checkmark.circle.fill" size={20} color="#16a34a" />
                            ) : pixError ? (
                              <IconSymbol name="xmark.circle.fill" size={20} color="#dc2626" />
                            ) : null}
                          </View>
                        </View>

                        {/* Status abaixo do campo */}
                        {pixValidated ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#16a34a15", borderColor: "#16a34a40", borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4 }}>
                            <IconSymbol name="checkmark.circle.fill" size={20} color="#16a34a" />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 11, fontWeight: "700", color: "#16a34a", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                Titular Confirmado no Banco Central
                              </Text>
                              <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
                                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.foreground }}>
                                  {pixHolderName || ownerName.trim() || name.trim() || "Titular da Conta"}
                                </Text>
                                {pixBankName ? (
                                  <View style={{ backgroundColor: "#16a34a25", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#16a34a" }}>
                                      ({pixBankName})
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          </View>
                        ) : pixValidating ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <ActivityIndicator size="small" color={colors.primary} />
                            <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>Verificando titular no Banco Central...</Text>
                          </View>
                        ) : pixError ? (
                          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 4 }}>
                            <IconSymbol name="exclamationmark.circle.fill" size={15} color="#dc2626" />
                            <Text style={{ fontSize: 12, color: "#dc2626", flex: 1 }}>{pixError}</Text>
                          </View>
                        ) : (
                          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                            A chave será validada automaticamente via Banco Central
                          </Text>
                        )}
                      </View>

                    </>
                  ) : (
                    <>
                      <Input label="Código do Banco (001=BB, 341=Itaú, 033=Santander...)" value={bankCode} onChangeText={setBankCode} placeholder="000" keyboardType="number-pad" />
                      <View style={{ flexDirection: "row", gap: 10 }}>
                        <View style={{ flex: 1 }}><Input label="Agência" value={bankAgency} onChangeText={setBankAgency} placeholder="0000" keyboardType="number-pad" /></View>
                        <View style={{ flex: 2 }}><Input label="Conta" value={bankAccount} onChangeText={setBankAccount} placeholder="00000000" keyboardType="number-pad" /></View>
                        <View style={{ width: 60 }}><Input label="Dígito" value={bankAccountDigit} onChangeText={setBankAccountDigit} placeholder="0" keyboardType="number-pad" /></View>
                      </View>
                      <View style={{ gap: 6 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>Tipo da Conta</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {(["CONTA_CORRENTE", "CONTA_POUPANCA"] as const).map((type) => (
                            <Pressable key={type} onPress={() => setBankAccountType(type)} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: bankAccountType === type ? colors.primary : colors.surface, borderWidth: 1, borderColor: bankAccountType === type ? colors.primary : colors.border }}>
                              <Text style={{ fontSize: 12, fontWeight: "700", color: bankAccountType === type ? "#fff" : colors.foreground }}>{type === "CONTA_CORRENTE" ? "Corrente" : "Poupança"}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>
                      <Input label="Nome do titular da conta" value={bankOwnerName} onChangeText={setBankOwnerName} placeholder="Nome completo ou razão social" />
                      <Input label="CPF/CNPJ do titular" value={bankCpfCnpj} onChangeText={setBankCpfCnpj} placeholder="000.000.000-00 ou CNPJ" keyboardType="number-pad" />
                    </>
                  )}
                </>
              )}
              <Input label="Telefone WhatsAPP" value={phone} onChangeText={handlePhoneChange} placeholder="(00) 00000-0000" keyboardType="phone-pad" />
              <Input label="E-mail" value={email} onChangeText={setEmail} placeholder="email@exemplo.com" keyboardType="email-address" />
            </>
          ) : (
            <>
              {profile === "customer" && (
                <Input label="CPF" value={cpf} onChangeText={handleCpfChange} placeholder="000.000.000-00" keyboardType="number-pad" />
              )}
              {profile === "company" && (
                <Input label="CNPJ" value={cnpj} onChangeText={handleCnpjChange} placeholder="00.000.000/0000-00" keyboardType="number-pad" />
              )}
              {profile === "deliverer" && (
                <Input label="E-mail" value={email} onChangeText={setEmail} placeholder="email@entregador.com" keyboardType="email-address" />
              )}
            </>
          )}
          <Input label="Senha" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
          {mode === "register" && (
            <Input label="Confirmar Senha" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="••••••••" secureTextEntry />
          )}
        </View>


        <Pressable
          onPress={submit}
          style={({ pressed }) => [
            { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 24, transform: [{ scale: pressed ? 0.98 : 1 }] },
          ]}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
            {loading ? "Carregando..." : (mode === "login" ? "Entrar" : "Criar conta e continuar")}
          </Text>
        </Pressable>

        {profile !== "deliverer" && (
          <Pressable
            onPress={() => {
              const newMode = mode === "login" ? "register" : "login";
              setMode(newMode);
              if (newMode === "register" && profile === "deliverer") {
                setProfile("customer");
              }
            }}
            style={({ pressed }) => [{ marginTop: 18, alignItems: "center", opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={{ color: colors.muted, fontSize: 14 }}>
              {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
              <Text style={{ color: colors.primary, fontWeight: "700" }}>
                {mode === "login" ? "Cadastre-se" : "Entrar"}
              </Text>
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 12,
          alignItems: "center",
          backgroundColor: active ? colors.primary : colors.surface,
          borderWidth: 1,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={{ color: active ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function Input({
  label,
  editable = true,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "number-pad" | "phone-pad";
  secureTextEntry?: boolean;
  editable?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 6, opacity: editable ? 1 : 0.5 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>{label}</Text>
      <TextInput
        {...props}
        editable={editable}
        autoCapitalize="none"
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        style={{
          backgroundColor: editable ? colors.surface : colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 13,
          color: colors.foreground,
          fontSize: 15,
        }}
      />
    </View>
  );
}

function SectionHeader({ label }: { label: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.8 }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}
