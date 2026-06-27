import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "magnifyingglass": "search",
  "cart.fill": "shopping-cart",
  "list.bullet": "receipt-long",
  "person.fill": "person",
  "star.fill": "star",
  "plus": "add",
  "pencil": "edit",
  "trash": "delete",
  "building.2.fill": "store",
  "checkmark": "check",
  "xmark": "close",
  "arrow.left": "arrow-back",
  "clock.fill": "schedule",
  "bag.fill": "shopping-bag",
  "gearshape.fill": "settings",
  "wrench.fill": "build",
  "location.fill": "location-on",
  "tag.fill": "local-offer",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
