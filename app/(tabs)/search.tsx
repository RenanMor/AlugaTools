import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState, useEffect } from "react";
import { FlatList, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { CATEGORIES } from "@/lib/data";
import { Tool } from "@/lib/types";

export default function SearchScreen() {
  const colors = useColors();
  const { tools, companies, user } = useApp();

  useEffect(() => {
    if (user?.profile === "deliverer") {
      router.replace("/orders");
    }
  }, [user]);
  const params = useLocalSearchParams<{ category?: string }>();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string | null>(params.category ?? null);

  const results = useMemo(() => {
    return tools.filter((t) => {
      const matchQuery = query.trim() === "" || t.name.toLowerCase().includes(query.toLowerCase());
      const matchCat = !activeCat || (t.categoryId && t.categoryId.split(",").map((c) => c.trim()).includes(activeCat));
      return matchQuery && matchCat;
    });
  }, [tools, query, activeCat]);

  const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? "";

  return (
    <ScreenContainer className="p-4">
      <Text style={{ fontSize: 24, fontWeight: "800", color: colors.foreground, marginBottom: 14 }}>
        Buscar ferramentas
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: colors.surface,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderWidth: 1,
          borderColor: colors.border,
          marginBottom: 14,
        }}
      >
        <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Digite o nome da ferramenta"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          style={{ flex: 1, color: colors.foreground, fontSize: 15 }}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, height: 42, marginBottom: 14 }}
        contentContainerStyle={{ gap: 8, alignItems: "center" }}
      >
        <CategoryChip label="Todas" active={!activeCat} onPress={() => setActiveCat(null)} />
        {CATEGORIES.map((c) => (
          <CategoryChip key={c.id} label={c.name} active={activeCat === c.id} onPress={() => setActiveCat(c.id)} />
        ))}
      </ScrollView>

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>
            Nenhuma ferramenta encontrada.
          </Text>
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => <ToolRow tool={item} company={companyName(item.companyId)} />}
      />
    </ScreenContainer>
  );
}

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: 16,
          paddingVertical: 9,
          borderRadius: 20,
          backgroundColor: active ? colors.primary : colors.surface,
          borderWidth: 1,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={{ color: active ? "#fff" : colors.foreground, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function ToolRow({ tool, company }: { tool: Tool; company: string }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/tool/[id]", params: { id: tool.id } })}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          gap: 12,
          padding: 10,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Image source={{ uri: tool.image || "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=200&q=80" }} style={{ width: 70, height: 70, borderRadius: 12, backgroundColor: colors.border }} />
      <View style={{ flex: 1, justifyContent: "center", gap: 3 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.foreground }}>
          {tool.name}
        </Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>{company}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>
            R$ {tool.pricePerDay}/dia
          </Text>
          <Text style={{ fontSize: 11, fontWeight: "600", color: tool.quantity > 0 && tool.available ? colors.success : colors.error }}>
            {tool.quantity > 0 && tool.available ? `${tool.quantity} disp.` : "Sem estoque"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
