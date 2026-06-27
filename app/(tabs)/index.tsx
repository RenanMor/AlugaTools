import { router } from "expo-router";
import { FlatList, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { StarRating } from "@/components/star-rating";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { CATEGORIES } from "@/lib/data";
import { Company } from "@/lib/types";

export default function HomeScreen() {
  const colors = useColors();
  const { companies } = useApp();

  return (
    <ScreenContainer>
      <FlatList
        data={companies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        ListHeaderComponent={
          <View style={{ gap: 18, marginBottom: 8 }}>
            <View>
              <Text style={{ fontSize: 26, fontWeight: "800", color: colors.foreground }}>
                RentTools
              </Text>
              <Text style={{ fontSize: 14, color: colors.muted, marginTop: 2 }}>
                Alugue ferramentas perto de você
              </Text>
            </View>

            <Pressable
              onPress={() => router.push("/search")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: colors.surface,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: 13,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <IconSymbol name="magnifyingglass" size={20} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 15 }}>O que você precisa alugar?</Text>
            </Pressable>

            <View>
              <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, marginBottom: 12 }}>
                Categorias
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => router.push({ pathname: "/search", params: { category: cat.id } })}
                    style={({ pressed }) => [
                      {
                        alignItems: "center",
                        gap: 8,
                        width: 78,
                        opacity: pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 18,
                        backgroundColor: colors.surface,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <IconSymbol name="wrench.fill" size={26} color={colors.primary} />
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: colors.foreground, textAlign: "center" }}>
                      {cat.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.foreground, marginTop: 4 }}>
              Empresas em destaque
            </Text>
          </View>
        }
        renderItem={({ item }) => <CompanyCard company={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </ScreenContainer>
  );
}

function CompanyCard({ company }: { company: Company }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/company/[id]", params: { id: company.id } })}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          gap: 14,
          padding: 12,
          borderRadius: 16,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Image
        source={{ uri: company.logo }}
        style={{ width: 68, height: 68, borderRadius: 14, backgroundColor: colors.border }}
      />
      <View style={{ flex: 1, justifyContent: "center", gap: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>{company.name}</Text>
        <Text numberOfLines={1} style={{ fontSize: 13, color: colors.muted }}>
          {company.description}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <StarRating value={company.rating} size={14} />
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {company.rating.toFixed(1)} ({company.ratingCount})
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
