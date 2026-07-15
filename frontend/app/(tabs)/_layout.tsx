import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform, View, Text } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { fontWeight as fw } from "@/lib/design-tokens";

function CartBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: "absolute",
        top: -4,
        right: -10,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: "#EF4444",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 3,
      }}
    >
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: fw.bold }}>{count}</Text>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { cart, user } = useApp();
  const isCompany = user?.profile === "company";
  const isDeliverer = user?.profile === "deliverer";
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: fw.semibold,
        },
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background + "F2",
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          // Glassmorphism-lite on web
          ...(Platform.OS === "web" ? {
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          } as any : {}),
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          href: (isDeliverer ? null : "/") as any,
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Buscar",
          href: (isDeliverer ? null : "/search") as any,
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="magnifyingglass" color={color} />,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Controle",
          href: (isCompany && !isDeliverer ? "/stats" : null) as any,
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="trending.up" color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Carrinho",
          href: (isCompany || isDeliverer ? null : "/cart") as any,
          tabBarIcon: ({ color }) => (
            <View>
              <IconSymbol size={24} name="cart.fill" color={color} />
              <CartBadge count={cart.length} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Pedidos",
          href: (isCompany ? null : "/orders") as any,
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Painel",
          href: (isCompany ? "/dashboard" : null) as any,
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="gearshape.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
