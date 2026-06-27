import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { ProfileType } from "@/lib/types";

export default function AuthScreen() {
  const colors = useColors();
  const { login, checkout, cart } = useApp();
  const params = useLocalSearchParams<{ intent?: string }>();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [profile, setProfile] = useState<ProfileType>("customer");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const finalName = name.trim() || email.split("@")[0] || "Usuário";
      await login(
        email.trim() || "usuario@email.com",
        finalName,
        profile,
        password || "123456",
        mode === "register"
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

      <View style={{ marginTop: 12, gap: 6 }}>
        <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>
          {mode === "login" ? "Entrar" : "Criar conta"}
        </Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>
          {params.intent === "checkout"
            ? "Entre para finalizar seu aluguel"
            : "Acesse sua conta RentTools"}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 22 }}>
        <Segment label="Sou Cliente" active={profile === "customer"} onPress={() => setProfile("customer")} />
        <Segment label="Sou Empresa" active={profile === "company"} onPress={() => setProfile("company")} />
      </View>

      <View style={{ gap: 14, marginTop: 22 }}>
        {mode === "register" && (
          <Input label="Nome" value={name} onChangeText={setName} placeholder="Seu nome" />
        )}
        <Input label="E-mail" value={email} onChangeText={setEmail} placeholder="email@exemplo.com" keyboardType="email-address" />
        <Input label="Senha" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
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
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address";
  secureTextEntry?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted }}>{label}</Text>
      <TextInput
        {...props}
        autoCapitalize="none"
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        style={{
          backgroundColor: colors.surface,
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
