import { router } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Image, Modal, Pressable, ScrollView, Text, TextInput, View, Alert } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { CATEGORIES } from "@/lib/data";
import { Rental, Tool, Deliverer } from "@/lib/types";
import { RentalTimer } from "@/components/rental-timer";

export default function DashboardScreen() {
  const colors = useColors();
  const {
    user,
    logout,
    tools,
    rentals,
    deliverers,
    addTool,
    updateTool,
    deleteTool,
    addDeliverer,
    updateDeliverer,
    deleteDeliverer,
    setRentalStatus,
    companies,
    updateCompanyStatus,
    refreshCatalog,
  } = useApp();
  const companyId = user?.companyId;
  const hasInvalidCompany = !companyId || companyId === "co1";
  
  const [tab, setTab] = useState<"requests" | "tools" | "deliverers">("requests");
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [showToolForm, setShowToolForm] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const myCompany = companyId ? companies.find((c) => c.id === companyId) : null;
  
  const [editingDeliverer, setEditingDeliverer] = useState<Deliverer | null>(null);
  const [showDelivererForm, setShowDelivererForm] = useState(false);

  const myTools = useMemo(() => tools.filter((t) => t.companyId === companyId), [tools, companyId]);
  const myRequests = useMemo(() => rentals.filter((r) => r.companyId === companyId), [rentals, companyId]);

  if (user?.profile === "company" && user.companyStatus !== "approved" && !hasInvalidCompany) {
    const isPending = user.companyStatus === "pending" || !user.companyStatus;
    return (
      <ScreenContainer style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
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
              ? "Sua empresa foi cadastrada com sucesso! Nossa equipe está analisando os dados. Você poderá acessar o painel assim que for aprovada."
              : "Sua empresa foi recusada pelo administrador do sistema. Por favor, entre em contato com o administrador do sistema para mais informações."}
          </Text>
          <Pressable
            onPress={async () => {
              await logout();
              router.replace("/");
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
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>Sair da Conta</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

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

  const openNewTool = () => {
    setEditingTool(null);
    setShowToolForm(true);
  };
  const openEditTool = (t: Tool) => {
    setEditingTool(t);
    setShowToolForm(true);
  };

  const openNewDeliverer = () => {
    setEditingDeliverer(null);
    setShowDelivererForm(true);
  };
  const openEditDeliverer = (d: Deliverer) => {
    setEditingDeliverer(d);
    setShowDelivererForm(true);
  };

  return (
    <ScreenContainer className="p-4" style={{ position: "relative" }}>
      {myCompany?.logo ? (
        <Image
          source={{ uri: myCompany.logo }}
          style={{
            position: "absolute",
            alignSelf: "center",
            top: "30%",
            width: 320,
            height: 320,
            opacity: 0.05,
            resizeMode: "contain",
            zIndex: -1,
          }}
        />
      ) : null}
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 14 }}>
        Painel da empresa
      </Text>

      {/* Toggle Open/Closed store */}
      {myCompany && (
        <Pressable
          onPress={async () => {
            if (isUpdatingStatus) return;
            setIsUpdatingStatus(true);
            try {
              const nextStatus = !myCompany.isOpen;
              await updateCompanyStatus(nextStatus);
              await refreshCatalog();
              Alert.alert("Sucesso", `Sua loja agora está ${nextStatus ? "ABERTA" : "FECHADA"}.`);
            } catch (err: any) {
              Alert.alert("Erro", "Não foi possível alterar o status da loja.");
            } finally {
              setIsUpdatingStatus(false);
            }
          }}
          disabled={isUpdatingStatus}
          style={({ pressed }) => [
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: myCompany.isOpen ? colors.primary + "15" : colors.error + "15",
              borderColor: myCompany.isOpen ? colors.primary : colors.error,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: 16,
              opacity: pressed || isUpdatingStatus ? 0.8 : 1,
            },
          ]}
        >
          <View style={{ gap: 2, flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.foreground }}>
              Status da Loja: {myCompany.isOpen ? "Loja Aberta" : "Loja Fechada"}
            </Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>
              {myCompany.isOpen 
                ? "Clientes podem buscar e alugar suas ferramentas" 
                : "Sua loja está fechada para novos aluguéis"}
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              backgroundColor: myCompany.isOpen ? colors.primary : colors.error,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>
              {myCompany.isOpen ? "Fechar Loja" : "Abrir Loja"}
            </Text>
          </View>
        </Pressable>
      )}

      <View style={{ flexDirection: "row", gap: 6, marginBottom: 16 }}>
        <TabButton label="Pedidos" active={tab === "requests"} onPress={() => setTab("requests")} />
        <TabButton label="Ferramentas" active={tab === "tools"} onPress={() => setTab("tools")} />
        <TabButton label="Entregadores" active={tab === "deliverers"} onPress={() => setTab("deliverers")} />
      </View>

      {tab === "requests" && (
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
          renderItem={({ item }) => <RequestCard rental={item} />}
        />
      )}

      {tab === "tools" && (
        <FlatList
          data={myTools}
          keyExtractor={(i) => i.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <Pressable
              onPress={openNewTool}
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
            <ToolManageRow tool={item} onEdit={() => openEditTool(item)} onDelete={() => deleteTool(item.id)} />
          )}
        />
      )}

      {tab === "deliverers" && (
        <FlatList
          data={deliverers}
          keyExtractor={(i) => i.id}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <Pressable
              onPress={openNewDeliverer}
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
              <Text style={{ color: "#fff", fontWeight: "700" }}>Adicionar entregador</Text>
            </Pressable>
          }
          renderItem={({ item }) => (
            <DelivererManageRow
              deliverer={item}
              onEdit={() => openEditDeliverer(item)}
              onDelete={() => deleteDeliverer(item.id)}
            />
          )}
        />
      )}

      <ToolFormModal
        visible={showToolForm}
        tool={editingTool}
        companyId={companyId}
        onClose={() => setShowToolForm(false)}
        onSave={(t) => {
          if ("id" in t && t.id) updateTool(t as Tool);
          else addTool(t);
          setShowToolForm(false);
        }}
      />

      <DelivererFormModal
        visible={showDelivererForm}
        deliverer={editingDeliverer}
        onClose={() => setShowDelivererForm(false)}
        onSave={async (d) => {
          if (editingDeliverer) {
            await updateDeliverer(editingDeliverer.id, d);
          } else {
            await addDeliverer(d);
          }
          setShowDelivererForm(false);
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

const STATUS_LABEL_BACK: Record<string, string> = {
  awaiting_payment: "Aguardando pag.",
  pending: "Aguardando entrega",
  accepted: "Entrega ant. solicitada",
  rejected: "Recusado",
  delivering: "Em entrega",
  delivered: "Entregue (Em uso)",
  active: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_COLOR_BACK: Record<string, string> = {
  awaiting_payment: "#3B82F6",
  pending: "#F59E0B",
  accepted: "#8B5CF6",
  rejected: "#EF4444",
  delivering: "#F97316",
  delivered: "#22C55E",
  active: "#22C55E",
  completed: "#64748B",
  cancelled: "#6B7280",
};

function RequestCard({ rental }: { rental: Rental }) {
  const colors = useColors();

  return (
    <Pressable
      onPress={() => router.push(`/order/${rental.id}`)}
      style={({ pressed }) => [
        {
          padding: 12,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 10,
          opacity: pressed ? 0.85 : 1,
        }
      ]}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Image source={{ uri: rental.toolImage }} style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: colors.border }} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
            {rental.toolName}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>Cliente: {rental.customerName}</Text>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>
            R$ {rental.totalPrice.toFixed(2)} · {rental.days}d
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
            backgroundColor: (STATUS_COLOR_BACK[rental.status] || colors.muted) + "15",
            alignSelf: "flex-start",
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "700", color: STATUS_COLOR_BACK[rental.status] || colors.muted }}>
            {STATUS_LABEL_BACK[rental.status] || rental.status}
          </Text>
        </View>
      </View>

      {/* Show Rental Countdown Timer if rental is delivered and active */}
      {rental.deliveredAt && (rental.status === "delivered" || rental.status === "active" || rental.status === "accepted") && (
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 8, gap: 4 }}>
          <Text style={{ fontSize: 12, color: colors.muted, fontWeight: "600" }}>Tempo Restante:</Text>
          <RentalTimer deliveredAt={rental.deliveredAt} days={rental.days} />
        </View>
      )}
    </Pressable>
  );
}

function ToolManageRow({ tool, onEdit, onDelete }: { tool: Tool; onEdit: () => void; onDelete: () => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 12, padding: 10, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
      <Image source={tool.image ? { uri: tool.image } : require("@/assets/images/sem-imagem.png")} style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: colors.border }} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>{tool.name}</Text>
        <Text style={{ fontSize: 13, fontWeight: "700", color: colors.success }}>
          R$ {tool.pricePerDay}/dia · Qtd: {tool.quantity ?? 1}
        </Text>
        <Text style={{ fontSize: 11, color: colors.muted }}>
          Aluguel: {tool.minDays ?? 1} a {tool.maxDays ?? 30} dias
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

function DelivererManageRow({
  deliverer,
  onEdit,
  onDelete,
}: {
  deliverer: Deliverer;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + "15", alignItems: "center", justifyContent: "center" }}>
        <IconSymbol name="person.fill" size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>{deliverer.name}</Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>{deliverer.email} · {deliverer.phone}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: deliverer.active ? colors.success : colors.muted }} />
          <Text style={{ fontSize: 11, fontWeight: "600", color: deliverer.active ? colors.success : colors.muted }}>
            {deliverer.active ? "Ativo" : "Inativo"}
          </Text>
        </View>
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
  const [minDays, setMinDays] = useState("1");
  const [maxDays, setMaxDays] = useState("30");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useMemo(() => {
    if (visible) {
      setName(tool?.name ?? "");
      setDescription(tool?.description ?? "");
      setPrice(tool ? String(tool.pricePerDay) : "");
      setImage(tool?.image ?? "");
      if (tool?.categoryId) {
        setSelectedCategories(tool.categoryId.split(",").map(c => c.trim()).filter(Boolean));
      } else {
        setSelectedCategories([CATEGORIES[0].id]);
      }
      setQuantity(tool ? String(tool.quantity ?? 1) : "1");
      setMinDays(tool ? String(tool.minDays ?? 1) : "1");
      setMaxDays(tool ? String(tool.maxDays ?? 30) : "30");
    }
  }, [visible, tool]);

  const save = () => {
    const parsedQty = Math.max(1, Number(quantity) || 1);
    const parsedMin = Math.max(1, Number(minDays) || 1);
    const parsedMax = Math.max(parsedMin, Number(maxDays) || 30);
    let cleanImage = image.trim();
    if (cleanImage && !/^https?:\/\//i.test(cleanImage)) {
      cleanImage = `https://${cleanImage}`;
    }
    const base = {
      companyId,
      name: name.trim() || "Nova ferramenta",
      description: description.trim(),
      categoryId: selectedCategories.join(","),
      image: cleanImage,
      pricePerDay: Number(price) || 0,
      quantity: parsedQty,
      available: parsedQty > 0,
      minDays: parsedMin,
      maxDays: parsedMax,
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
                <Field label="Quantidade disponível" value={quantity} onChangeText={setQuantity} placeholder="1" keyboardType="numeric" />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label="Mínimo de dias" value={minDays} onChangeText={setMinDays} placeholder="1" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Máximo de dias" value={maxDays} onChangeText={setMaxDays} placeholder="30" keyboardType="numeric" />
              </View>
            </View>

            <Field label="URL da imagem" value={image} onChangeText={setImage} placeholder="https://..." />

            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8 }}>Categorias (selecione várias se desejar)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flexGrow: 0, height: 38, marginBottom: 16 }}
              contentContainerStyle={{ gap: 8, alignItems: "center" }}
            >
              <Pressable
                onPress={() => {
                  const allSelected = selectedCategories.length === CATEGORIES.length;
                  if (allSelected) {
                    setSelectedCategories([CATEGORIES[0].id]);
                  } else {
                    setSelectedCategories(CATEGORIES.map((c) => c.id));
                  }
                }}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 18,
                    backgroundColor: selectedCategories.length === CATEGORIES.length ? colors.primary : colors.surface,
                    borderWidth: 1,
                    borderColor: selectedCategories.length === CATEGORIES.length ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Text style={{ color: selectedCategories.length === CATEGORIES.length ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>Todas</Text>
              </Pressable>

              {CATEGORIES.map((c) => {
                const isSelected = selectedCategories.includes(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setSelectedCategories((prev) => {
                        if (isSelected) {
                          if (prev.length <= 1) return prev;
                          return prev.filter((id) => id !== c.id);
                        } else {
                          return [...prev, c.id];
                        }
                      });
                    }}
                    style={({ pressed }) => [
                      {
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 18,
                        backgroundColor: isSelected ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.primary : colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: isSelected ? "#fff" : colors.foreground, fontSize: 13, fontWeight: "600" }}>{c.name}</Text>
                  </Pressable>
                );
              })}
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

function DelivererFormModal({
  visible,
  deliverer,
  onClose,
  onSave,
}: {
  visible: boolean;
  deliverer: Deliverer | null;
  onClose: () => void;
  onSave: (d: { name: string; email: string; phone: string; password?: string; active?: boolean }) => Promise<void>;
}) {
  const colors = useColors();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);

  useMemo(() => {
    if (visible) {
      setName(deliverer?.name ?? "");
      setEmail(deliverer?.email ?? "");
      setPhone(deliverer?.phone ?? "");
      setPassword("");
      setActive(deliverer ? deliverer.active : true);
    }
  }, [visible, deliverer]);

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

  const save = async () => {
    if (!name.trim() || !email.trim() || !phone.trim()) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    if (!deliverer && !password.trim()) {
      alert("A senha de acesso temporária é obrigatória para novos entregadores.");
      return;
    }
    setLoading(true);
    try {
      await onSave({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password: password ? password : undefined,
        active,
      });
      onClose();
    } catch (e) {
      // Already handled or logged
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "88%" }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.foreground, marginBottom: 16 }}>
              {deliverer ? "Editar entregador" : "Adicionar entregador"}
            </Text>

            <Field label="Nome Completo *" value={name} onChangeText={setName} placeholder="Nome do entregador" />
            <Field label="E-mail *" value={email} onChangeText={setEmail} placeholder="exemplo@entregador.com" keyboardType="default" />
            <Field label="Telefone *" value={phone} onChangeText={handlePhoneChange} placeholder="(11) 99999-9999" keyboardType="numeric" />
            
            {!deliverer && (
              <Field label="Senha Temporária *" value={password} onChangeText={setPassword} placeholder="Mínimo 6 caracteres" secureTextEntry />
            )}

            {deliverer && (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, padding: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground }}>Conta Ativa</Text>
                <Pressable
                  onPress={() => setActive(!active)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 8,
                    backgroundColor: active ? colors.success + "15" : colors.border,
                  }}
                >
                  <Text style={{ color: active ? colors.success : colors.foreground, fontWeight: "700" }}>
                    {active ? "Sim" : "Não"}
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={onClose}
                disabled={loading}
                style={({ pressed }) => [{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
              >
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={loading}
                style={({ pressed }) => [{ flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center", backgroundColor: colors.primary, opacity: pressed || loading ? 0.85 : 1 }]}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {loading ? "Salvando..." : deliverer ? "Salvar" : "Adicionar"}
                </Text>
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
  secureTextEntry,
  ...props
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric";
  multiline?: boolean;
  secureTextEntry?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 6 }}>{label}</Text>
      <TextInput
        {...props}
        secureTextEntry={secureTextEntry}
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
