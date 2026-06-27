import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View, ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { ProfileType } from "@/lib/types";
import { apiCall } from "@/lib/_core/api";

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

export default function AuthScreen() {
  const colors = useColors();
  const { login, checkout, cart } = useApp();
  const params = useLocalSearchParams<{ intent?: string }>();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [profile, setProfile] = useState<ProfileType>("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

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

  const submit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (mode === "register") {
        const cleanCpf = cpf.replace(/\D/g, "");
        if (!cleanCpf) {
          alert("CPF é obrigatório");
          setLoading(false);
          return;
        }
        if (!validateCPF(cleanCpf)) {
          alert("CPF inválido. Certifique-se de preencher um CPF real.");
          setLoading(false);
          return;
        }

        const cleanPhone = phone.replace(/\D/g, "");
        if (!cleanPhone || cleanPhone.length < 10) {
          alert("Telefone inválido (deve conter DDD e o número)");
          setLoading(false);
          return;
        }

        if (!name.trim()) {
          alert("Nome é obrigatório e deve coincidir com o titular do CPF");
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
        if (!email.trim()) {
          alert("E-mail é obrigatório");
          setLoading(false);
          return;
        }
        if (!password) {
          alert("Senha é obrigatória");
          setLoading(false);
          return;
        }
      }

      await login(
        email.trim(),
        name.trim() || "Usuário",
        profile,
        password,
        mode === "register",
        cpf,
        phone
      );

      if (params.intent === "checkout" && profile === "customer" && cart.length > 0) {
        await checkout();
        router.dismiss();
        router.push("/orders");
        return;
      }
      router.dismiss();
      if (profile === "company") router.push("/dashboard");
    } catch (err: any) {
      alert(err.message || "Erro de autenticação. Verifique suas credenciais.");
    } finally {
      setLoading(false);
    }
  };

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
            : "Acesse sua conta RentTools"}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          <Segment label="Sou Cliente" active={profile === "customer"} onPress={() => setProfile("customer")} />
          <Segment label="Sou Empresa" active={profile === "company"} onPress={() => setProfile("company")} />
        </View>

        <View style={{ gap: 14, marginTop: 22 }}>
          {mode === "register" && (
            <>
              <Input label="CPF" value={cpf} onChangeText={handleCpfChange} placeholder="000.000.000-00" keyboardType="number-pad" />
              <Input
                label="Nome completo"
                value={name}
                onChangeText={setName}
                placeholder="Nome do titular do CPF"
                editable={validateCPF(cpf.replace(/\D/g, ""))}
              />
              <Input label="Telefone" value={phone} onChangeText={handlePhoneChange} placeholder="(00) 00000-0000" keyboardType="phone-pad" />
            </>
          )}
          <Input label="E-mail" value={email} onChangeText={setEmail} placeholder="email@exemplo.com" keyboardType="email-address" />
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

        <Pressable
          onPress={() => setMode(mode === "login" ? "register" : "login")}
          style={({ pressed }) => [{ marginTop: 18, alignItems: "center", opacity: pressed ? 0.6 : 1 }]}
        >
          <Text style={{ color: colors.muted, fontSize: 14 }}>
            {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
            <Text style={{ color: colors.primary, fontWeight: "700" }}>
              {mode === "login" ? "Cadastre-se" : "Entrar"}
            </Text>
          </Text>
        </Pressable>
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
      <Text style={{ color: active ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 14 }}>{label}</Text>
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
