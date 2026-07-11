import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Platform } from "react-native";

/**
 * Combines class names using clsx and tailwind-merge.
 * This ensures Tailwind classes are properly merged without conflicts.
 *
 * Usage:
 * ```tsx
 * cn("px-4 py-2", isActive && "bg-primary", className)
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function extractPrimaryColor(imageUrl: string): Promise<string> {
  if (!imageUrl || imageUrl.includes("sem-imagem")) {
    return "#F97316";
  }
  
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 10;
          canvas.height = 10;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve("#F97316");
          ctx.drawImage(img, 0, 0, 10, 10);
          const data = ctx.getImageData(0, 0, 10, 10).data;
          
          let r = 0, g = 0, b = 0, count = 0;
          for (let i = 0; i < data.length; i += 4) {
            const pr = data[i];
            const pg = data[i+1];
            const pb = data[i+2];
            const brightness = (pr + pg + pb) / 3;
            if (brightness > 240 || brightness < 15) continue;
            r += pr;
            g += pg;
            b += pb;
            count++;
          }
          if (count === 0) {
            r = data[0];
            g = data[1];
            b = data[2];
            count = 1;
          }
          const rgbToHex = (r: number, g: number, b: number) =>
            "#" + [r, g, b].map(x => {
              const hex = Math.round(x).toString(16);
              return hex.length === 1 ? "0" + hex : hex;
            }).join("");
          resolve(rgbToHex(r / count, g / count, b / count));
        } catch {
          resolve("#F97316");
        }
      };
      img.onerror = () => resolve("#F97316");
      img.src = imageUrl;
    });
  } else {
    let hash = 0;
    for (let i = 0; i < imageUrl.length; i++) {
      hash = imageUrl.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = ["#F97316", "#3B82F6", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#F59E0B"];
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }
}
