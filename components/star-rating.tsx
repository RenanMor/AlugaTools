import { Pressable, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";

export function StarRating({
  value,
  size = 16,
  editable = false,
  onChange,
}: {
  value: number;
  size?: number;
  editable?: boolean;
  onChange?: (v: number) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = i <= Math.round(value);
        const star = (
          <IconSymbol name="star.fill" size={size} color={filled ? "#FBBF24" : "#CBD5E1"} />
        );
        if (!editable) return <View key={i}>{star}</View>;
        return (
          <Pressable
            key={i}
            onPress={() => onChange?.(i)}
            style={({ pressed }) => [pressed && { opacity: 0.6 }]}
          >
            {star}
          </Pressable>
        );
      })}
    </View>
  );
}
