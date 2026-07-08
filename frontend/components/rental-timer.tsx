import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

interface RentalTimerProps {
  deliveredAt: number | undefined;
  days: number;
}

export function RentalTimer({ deliveredAt, days }: RentalTimerProps) {
  const colors = useColors();
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [isWarning, setIsWarning] = useState<boolean>(false);

  useEffect(() => {
    if (!deliveredAt) {
      setTimeLeft("Aguardando entrega...");
      return;
    }

    const expiryTime = deliveredAt + days * 24 * 60 * 60 * 1000;

    const updateTimer = () => {
      const diff = expiryTime - Date.now();

      if (diff <= 0) {
        setTimeLeft("Tempo expirado");
        setIsWarning(true);
        return;
      }

      // Convert diff to days, hours, minutes, seconds
      const totalSecs = Math.floor(diff / 1000);
      const secs = totalSecs % 60;
      const totalMins = Math.floor(totalSecs / 60);
      const mins = totalMins % 60;
      const totalHrs = Math.floor(totalMins / 60);
      const hrs = totalHrs % 24;
      const d = Math.floor(totalHrs / 24);

      // Warning if less than 6 hours remaining
      if (diff < 6 * 60 * 60 * 1000) {
        setIsWarning(true);
      } else {
        setIsWarning(false);
      }

      const formattedSecs = secs.toString().padStart(2, "0");
      const formattedMins = mins.toString().padStart(2, "0");
      const formattedHrs = hrs.toString().padStart(2, "0");

      if (d > 0) {
        setTimeLeft(`${d}d ${formattedHrs}:${formattedMins}:${formattedSecs}`);
      } else {
        setTimeLeft(`${formattedHrs}:${formattedMins}:${formattedSecs}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [deliveredAt, days]);

  const badgeBg = isWarning ? `${colors.error}15` : `${colors.success}15`;
  const textColor = isWarning ? colors.error : colors.success;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: badgeBg,
        borderWidth: 0.5,
        borderColor: textColor + "33",
        alignSelf: "flex-start",
      }}
    >
      <IconSymbol name="clock" size={14} color={textColor} />
      <Text style={{ fontSize: 13, fontWeight: "700", color: textColor }}>
        {timeLeft}
      </Text>
    </View>
  );
}
