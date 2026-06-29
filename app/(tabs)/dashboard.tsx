import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { CATEGORIES } from "@/lib/data";
import { Rental, Tool } from "@/lib/types";

export default function DashboardScreen() {
  const colors = useColors();
  const { user, tools, rentals, addTool, updateTool, deleteTool, setRentalStatus } = useApp();
  const companyId = user?.companyId;
  const hasInvalidCompany = !companyId || companyId === "co1";
  const [tab, setTab] = useState<"tools" | "requests">("requests");
  const [editing, setEditing] = useState<Tool | null>(null);
  const [showForm, setShowForm] = useState(false);

  const myTools = useMemo(() => tools.filter((t) => t.companyId === companyId), [tools, companyId]);
  const myRequests = useMemo(() => rentals.filter((r) => r.companyId === companyId), [rentals, companyId]);

  if (!user || user.profile !== "company" || hasInvalidCompany) {
    return (
      <ScreenContainer className="p-4">
        <View style={{ alignItems: "center", marginTop: 100, gap: 12 }}>
          <IconSymbol name="building.2.fill" size={48} color={colors.muted} />
          <Text style={{ color: colors.muted, textAlign: "center", maxWidth: 280 }}>
            {hasInvalidCompany && user
              ? "Sua conta de empresa precisa ser sincronizada. Por favor, faça logout e entre novamente para ativar o painel."
              : "Entre como empresa para acessar o painel."}
          </Text>
          <Pressable
            onPress={() => router.push("/auth")}
            style={({ pressed }) => [
              { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {hasInvalidCompany && user ? "Ir para Login / Logout" : "Entrar"}
            </Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };
  const openEdit = (t: Tool) => {
    setEditing(t);
    setShowForm(true);
  };

  return (
    <ScreenContainer className="p-4">
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 14 }}>
        Painel da empresa
      </Text>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        <TabButton label="Pedidos" active={tab === "requests"} onPress={() => setTab("requests")} />
        <TabButton label="Minhas ferramentas" active={tab === "tools"} onPress={() => setTab("tools")} />
      </View>

      {tab === "requests" ? (
        <FlatList
          data={myRequests}
          keyExtractor={(i) => i.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
              Nenhum pedido recebido ainda.
            </Text>
          }
          renderItem={({ item }) => (
            <RequestCard rental={item} onStatus={(s) => setRentalStatus(item.id, s)} />
          )}
        />
      ) : (
        <FlatList
          data={myTools}
          keyExtractor={(i) => i.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <Pressable
              onPress={openNew}
              style={({ pressed }) => [
                {
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  paddingVertical: 13,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  marginBottom: 12,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <IconSymbol name="plus" size={18} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700" }}>Adicionar ferramenta</Text>
            </Pressable>
          }
          renderItem={({ item }) => (
            <ToolManageRow tool={item} onEdit={() => openEdit(item)} onDelete={() => deleteTool(item.id)} />
          )}
        />
      )}

      <ToolFormModal
        visible={showForm}
        tool={editing}
        companyId={companyId}
        onClose={() => setShowForm(false)}
        onSave={(t) => {
          if ("id" in t && t.id) updateTool(t as Tool);
          else addTool(t);
          setShowForm(false);
        }}
      />
    </ScreenContainer>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          paddingVertical: 11,
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

function RequestCard({ rental, onStatus }: { rental: Rental; onStatus: (s: Rental["status"]) => void }) {
  const colors = useColors();
  return (
    <View style={{ padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Image source={{ uri: rental.toolImage }} style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: colors.border }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
            {rental.toolName}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>{rental.customerName}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
            R$ {rental.totalPrice.toFixed(2)} · {rental.days}d
          </Text>
        </View>
      </View>

      {rental.status === "pending" && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => onStatus("accepted")}
            style={({ pressed }) => [{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: colors.success, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Aceitar</Text>
          </Pressable>
          <Pressable
            onPress={() => onStatus("rejected")}
            style={({ pressed }) => [{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: colors.error, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>Recusar</Text>
          </Pressable>
        </View>
      )}

      {rental.status === "accepted" && (
        <Pressable
          onPress={() => onStatus("active")}
          style={({ pressed }) => [{ paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Iniciar serviço</Text>
        </Pressable>
      )}

      {(rental.status === "active" || rental.status === "completed" || rental.status === "rejected") && (
        <Text style={{ fontSize: 12, color: colors.muted }}>
          Status: {rental.status === "active" ? "Em andamento" : rental.status === "completed" ? "Concluído" : "Recusado"}
        </Text>
      )}
    </View>
  );
}

function ToolManageRow({ tool, onEdit, onDelete }: { tool: Tool; onEdit: () => void; onDelete: () => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 12, padding: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
      <Image source={{ uri: tool.image || "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=200&q=80" }} style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: colors.border }} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>{tool.name}</Text>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
          R$ {tool.pricePerDay}/dia · Qtd: {tool.quantity ?? 1}
        </Text>
      </View>
      <Pressable onPress={onEdit} style={({ pressed }) => [{ padding: 8, opacity: pressed ? 0.6 : 1 }]}>
        <IconSymbol name="pencil" size={20} color={colors.muted} />
      </Pressable>
      <Pressable onPress={onDelete} style={({ pressed }) => [{ padding: 8, opacity: pressed ? 0.6 : 1 }]}>
        <IconSymbol name="trash" size={20} color={colors.error} />
      </Pressable>
    </View>
  );
}

function ToolFormModal({
  visible,
  tool,
  companyId,
  onClose,
  onSave,
}: {
  visible: boolean;
  tool: Tool | null;
  companyId: string;
  onClose: () => void;
  onSave: (t: Tool | Omit<Tool, "id">) => void;
}) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);

  useMemo(() => {
    if (visible) {
      setName(tool?.name ?? "");
      setDescription(tool?.description ?? "");
      setPrice(tool ? String(tool.pricePerDay) : "");
      setImage(tool?.image ?? "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400&q=80");
      setCategoryId(tool?.categoryId ?? CATEGORIES[0].id);
      setQuantity(tool ? String(tool.quantity ?? 1) : "1");
    }
  }, [visible, tool]);

  const save = () => {
    const parsedQty = Number(quantity) || 1;
    let cleanImage = image.trim();
    if (cleanImage && !/^https?:\/\//i.test(cleanImage)) {
      cleanImage = `https://${cleanImage}`;
    }
    const base = {
      companyId,
      name: name.trim() || "Nova ferramenta",
      description: description.trim(),
      categoryId,
      image: cleanImage,
      pricePerDay: Number(price) || 0,
      quantity: parsedQty,
      available: parsedQty > 0,
    };
    if (tool) onSave({ ...base, id: tool.id });
    else onSave(base);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "88%" }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground, marginBottom: 16 }}>
              {tool ? "Editar ferramenta" : "Nova ferramenta"}
            </Text>

            <Field label="Nome" value={name} onChangeText={setName} placeholder="Ex: Furadeira 750W" />
            <Field label="Descrição" value={description} onChangeText={setDescription} placeholder="Detalhes da ferramenta" multiline />
            
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="Preço por dia (R$)" value={price} onChangeText={setPrice} placeholder="35" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Quantidade" value={quantity} onChangeText={setQuantity} placeholder="1" keyboardType="numeric" />
              </View>
            </View>

            <Field label="URL da imagem" value={image} onChangeText={setImage} placeholder="https://..." />

            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8 }}>Categoria</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCategoryId(c.id)}
                  style={({ pressed }) => [
                    {
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 18,
                      backgroundColor: categoryId === c.id ? colors.primary : colors.surface,
                      borderWidth: 1,
                      borderColor: categoryId === c.id ? colors.primary : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: categoryId === c.id ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={save}
                style={({ pressed }) => [{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>{tool ? "Salvar" : "Adicionar"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  multiline,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 6 }}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: colors.foreground,
          fontSize: 15,
          minHeight: multiline ? 70 : undefined,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}
