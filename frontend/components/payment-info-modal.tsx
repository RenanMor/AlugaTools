import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { spacing, fontSize, fontWeight, radius } from "@/lib/design-tokens";
import { Company } from "@/lib/types";

interface PaymentInfoModalProps {
  visible: boolean;
  onClose: () => void;
  company: Company | null;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={{ gap: 3 }}>
      <Text style={{ fontSize: 11, fontWeight: "600", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.foreground }}>
        {value}
      </Text>
    </View>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />;
}

function maskPixKey(type: string, key: string): string {
  if (!key) return "—";
  if (type === "CPF") {
    const d = key.replace(/\D/g, "");
    return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : key;
  }
  if (type === "CNPJ") {
    const d = key.replace(/\D/g, "");
    return d.length === 14 ? `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**` : key;
  }
  if (type === "EMAIL") {
    const [user, domain] = key.split("@");
    if (!domain) return key;
    return `${user.slice(0, 2)}***@${domain}`;
  }
  if (type === "PHONE") {
    const d = key.replace(/\D/g, "");
    return d.length >= 8 ? `+55 (**) *****-${d.slice(-4)}` : key;
  }
  // EVP — show only last 8 chars
  return key.length > 8 ? `****-****-****-${key.slice(-12)}` : key;
}

const PIX_TYPE_LABELS: Record<string, string> = {
  CPF: "CPF",
  CNPJ: "CNPJ",
  EMAIL: "E-mail",
  PHONE: "Telefone",
  EVP: "Chave Aleatória",
};

const BANK_NAMES: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "077": "Banco Inter",
  "104": "Caixa Econômica",
  "237": "Bradesco",
  "341": "Itaú",
  "356": "BMG",
  "389": "Mercantil do Brasil",
  "422": "Safra",
  "633": "Rendimento",
  "735": "Neon",
  "748": "Sicredi",
  "756": "Sicoob",
};

export function PaymentInfoModal({ visible, onClose, company }: PaymentInfoModalProps) {
  const colors = useColors();

  const hasPix = !!(company?.pixKey && company?.pixKeyType);
  const hasTed = !!(company?.bankCode && company?.bankAccount);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.xl,
            gap: spacing.lg,
            maxHeight: "80%",
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <IconSymbol name="creditcard.fill" size={22} color={colors.primary} />
              <Text style={{ fontSize: 18, fontWeight: fontWeight.black, color: colors.foreground }}>
                Formas de Receber
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <IconSymbol name="xmark" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ gap: spacing.lg }}>

              {/* PIX Section */}
              {hasPix && (
                <View
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                    gap: spacing.md,
                    borderWidth: 1,
                    borderColor: "#16a34a40",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: "#16a34a20",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>🔑</Text>
                    </View>
                    <Text style={{ fontSize: fontSize.md + 1, fontWeight: fontWeight.bold, color: "#16a34a" }}>
                      Pix
                    </Text>
                  </View>

                  <Divider />

                  <InfoRow
                    label="Tipo de Chave"
                    value={PIX_TYPE_LABELS[company?.pixKeyType || ""] || company?.pixKeyType || "—"}
                  />
                  <InfoRow
                    label="Chave Pix"
                    value={maskPixKey(company?.pixKeyType || "", company?.pixKey || "")}
                  />
                  {company?.bankOwnerName && (
                    <InfoRow label="Titular" value={company.bankOwnerName} />
                  )}
                  {company?.bankCpfCnpj && (
                    <InfoRow
                      label="CPF/CNPJ do Titular"
                      value={
                        company.bankCpfCnpj.length === 11
                          ? `***.${company.bankCpfCnpj.slice(3, 6)}.${company.bankCpfCnpj.slice(6, 9)}-**`
                          : `**.${company.bankCpfCnpj.slice(2, 5)}.${company.bankCpfCnpj.slice(5, 8)}/****-**`
                      }
                    />
                  )}
                </View>
              )}

              {/* TED / Conta Bancária */}
              {hasTed && (
                <View
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: radius.lg,
                    padding: spacing.lg,
                    gap: spacing.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: colors.primary + "20",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconSymbol name="building.columns.fill" size={18} color={colors.primary} />
                    </View>
                    <Text style={{ fontSize: fontSize.md + 1, fontWeight: fontWeight.bold, color: colors.primary }}>
                      TED / Conta Bancária
                    </Text>
                  </View>

                  <Divider />

                  <InfoRow
                    label="Banco"
                    value={
                      company?.bankCode
                        ? `${company.bankCode}${BANK_NAMES[company.bankCode] ? ` — ${BANK_NAMES[company.bankCode]}` : ""}`
                        : "—"
                    }
                  />
                  <View style={{ flexDirection: "row", gap: spacing.lg }}>
                    <View style={{ flex: 1 }}>
                      <InfoRow label="Agência" value={company?.bankAgency || "—"} />
                    </View>
                    <View style={{ flex: 2 }}>
                      <InfoRow
                        label="Conta"
                        value={
                          company?.bankAccount
                            ? `${company.bankAccount}${company.bankAccountDigit ? `-${company.bankAccountDigit}` : ""}`
                            : "—"
                        }
                      />
                    </View>
                  </View>
                  {company?.bankAccountType && (
                    <InfoRow
                      label="Tipo"
                      value={company.bankAccountType === "CONTA_CORRENTE" ? "Conta Corrente" : "Conta Poupança"}
                    />
                  )}
                  {company?.bankOwnerName && (
                    <InfoRow label="Titular" value={company.bankOwnerName} />
                  )}
                  {company?.bankCpfCnpj && (
                    <InfoRow
                      label="CPF/CNPJ do Titular"
                      value={
                        company.bankCpfCnpj.length === 11
                          ? `***.${company.bankCpfCnpj.slice(3, 6)}.${company.bankCpfCnpj.slice(6, 9)}-**`
                          : `**.${company.bankCpfCnpj.slice(2, 5)}.${company.bankCpfCnpj.slice(5, 8)}/****-**`
                      }
                    />
                  )}
                </View>
              )}

              {/* Empty state */}
              {!hasPix && !hasTed && (
                <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl }}>
                  <IconSymbol name="creditcard" size={48} color={colors.muted} />
                  <Text style={{ fontSize: fontSize.md, color: colors.muted, textAlign: "center", lineHeight: 22 }}>
                    Nenhuma forma de recebimento cadastrada.{"\n"}
                    Atualize os dados pelo administrador ou refaça o cadastro.
                  </Text>
                </View>
              )}

              {/* Read-only notice */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 4 }}>
                <IconSymbol name="lock.fill" size={12} color={colors.muted} />
                <Text style={{ fontSize: 11, color: colors.muted }}>
                  Dados somente para visualização — não é possível alterar aqui.
                </Text>
              </View>
            </View>
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={({ pressed }) => ({
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingVertical: 14,
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontWeight: fontWeight.bold, fontSize: fontSize.md, color: colors.foreground }}>
              Fechar
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
