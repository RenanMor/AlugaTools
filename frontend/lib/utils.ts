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

/**
 * Returns a short, clean public order ID slug for URLs.
 * Example: "466b66c9-4bde-4b73-b489-514b977767e6" -> "466B66C9"
 */
export function getShortOrderId(id: string): string {
  if (!id) return "00000000";
  const clean = id.replace(/^(pedido#)/i, "").replace(/-/g, "").toUpperCase();
  return clean.slice(0, 8);
}

/**
 * Formats a rental ID into a friendly, safe public identifier string.
 * Example: "466b66c9-4bde-4b73-b489-514b977767e6" -> "Pedido#466B66C9"
 */
export function formatOrderId(id: string): string {
  return `Pedido#${getShortOrderId(id)}`;
}

/** Returns true when the color is too close to gray (saturation < threshold) */
function isGrayish(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const luminance = (max + min) / 2;
  const saturation = luminance === 0 || luminance === 255 ? 0 : chroma / (255 - Math.abs(2 * luminance - 255));
  return saturation < 0.12;
}

function sanitizeColor(hex: string): string | null {
  const h = hex.replace("#", "");
  if (h.length !== 6) return null;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  if (isGrayish(r, g, b)) return null; // skip grays for brand color
  return hex;
}

/**
 * Resizes and compresses an image (File or base64/URL) using an offscreen canvas.
 * Prevents bloated storage and avoids localStorage quota limits.
 */
export async function compressImage(
  input: any,
  maxWidth = 512,
  maxHeight = 512,
  quality = 0.85
): Promise<string> {
  if (Platform.OS !== "web") {
    if (typeof input === "string") return input;
    return "";
  }

  return new Promise((resolve, reject) => {
    const processImg = (imgSrc: string) => {
      const img = new Image();
      if (!imgSrc.startsWith("data:")) {
        img.crossOrigin = "Anonymous";
      }
      img.onload = () => {
        try {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(imgSrc);

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", quality);
          resolve(compressed);
        } catch (e) {
          console.warn("[compressImage] Failed to compress on canvas:", e);
          resolve(imgSrc);
        }
      };
      img.onerror = () => resolve(imgSrc);
      img.src = imgSrc;
    };

    if (typeof input === "string") {
      processImg(input);
    } else if (input instanceof Blob || (typeof File !== "undefined" && input instanceof File)) {
      const reader = new FileReader();
      reader.onload = () => {
        processImg(reader.result as string);
      };
      reader.onerror = () => reject(new Error("Erro ao ler arquivo de imagem"));
      reader.readAsDataURL(input);
    } else {
      resolve("");
    }
  });
}

/** Module-level cache for extracted palettes to avoid redundant processing */
const _paletteCache = new Map<string, { primary: string; secondary: string }>();

export async function extractPalette(imageUrl: string): Promise<{ primary: string; secondary: string }> {
  const defaultColors = { primary: "#F97316", secondary: "#FB923C" };
  if (!imageUrl || imageUrl.includes("sem-imagem")) {
    return defaultColors;
  }

  // Return cached result if available
  const cached = _paletteCache.get(imageUrl);
  if (cached) return cached;
  
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      const img = new Image();
      if (!imageUrl.startsWith("data:")) {
        img.crossOrigin = "Anonymous";
      }
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 24;
          canvas.height = 24;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(defaultColors);
          ctx.drawImage(img, 0, 0, 24, 24);
          const data = ctx.getImageData(0, 0, 24, 24).data;
          
          const colorCount: Record<string, number> = {};
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            const a = data[i+3];
            if (a < 50) continue; // ignore transparent
            
            const brightness = (r + g + b) / 3;
            if (brightness > 245 || brightness < 15) continue; // skip pure white/black
            
            const hex = "#" + [r, g, b].map(x => {
              const h = Math.round(x).toString(16);
              return h.length === 1 ? "0" + h : h;
            }).join("");
            
            colorCount[hex] = (colorCount[hex] || 0) + 1;
          }
          
          const sortedColors = Object.entries(colorCount).sort((a, b) => b[1] - a[1]);
          
          let primary = defaultColors.primary;
          let secondary = defaultColors.secondary;
          let primarySet = false;
          
          for (const [hex] of sortedColors) {
            const sanitized = sanitizeColor(hex);
            if (sanitized) {
              if (!primarySet) {
                primary = sanitized;
                primarySet = true;
              } else if (sanitized !== primary) {
                secondary = sanitized;
                break;
              }
            }
          }

          // If no saturated color was found, fallback to first non-black/white color or default
          if (!primarySet && sortedColors.length > 0) {
            primary = sortedColors[0][0];
            secondary = sortedColors[1] ? sortedColors[1][0] : defaultColors.secondary;
          }
          
          const result = { primary, secondary };
          _paletteCache.set(imageUrl, result);
          resolve(result);
        } catch {
          resolve(defaultColors);
        }
      };
      img.onerror = () => resolve(defaultColors);
      img.src = imageUrl;
    });
  } else {
    // Native fallback using hash to choose a beautiful premium palette pair
    let hash = 0;
    for (let i = 0; i < imageUrl.length; i++) {
      hash = imageUrl.charCodeAt(i) + ((hash << 5) - hash);
    }
    const palettes = [
      { primary: "#F97316", secondary: "#FB923C" },
      { primary: "#3B82F6", secondary: "#60A5FA" },
      { primary: "#8B5CF6", secondary: "#A78BFA" },
      { primary: "#EC4899", secondary: "#F472B6" },
      { primary: "#F59E0B", secondary: "#FBBF24" },
      { primary: "#06B6D4", secondary: "#22D3EE" },
    ];
    const index = Math.abs(hash) % palettes.length;
    const result = palettes[index];
    _paletteCache.set(imageUrl, result);
    return result;
  }
}

export async function extractPrimaryColor(imageUrl: string): Promise<string> {
  const palette = await extractPalette(imageUrl);
  return palette.primary;
}

export function adjustContrast(hexColor: string, isDarkTheme: boolean): string {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return hexColor;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance: L = 0.2126 * R + 0.7152 * G + 0.0722 * B
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  const rgbToHex = (r: number, g: number, b: number) =>
    "#" + [r, g, b].map(x => {
      const h = Math.max(0, Math.min(255, Math.round(x))).toString(16);
      return h.length === 1 ? "0" + h : h;
    }).join("");

  if (isDarkTheme) {
    // If in Dark Mode and color is too dark (luminance < 0.35), lighten it
    if (luminance < 0.35) {
      const factor = 0.45 / (luminance + 0.05);
      return rgbToHex(r * factor, g * factor, b * factor);
    }
  } else {
    // If in Light Mode and color is too light (luminance > 0.65), darken it
    if (luminance > 0.65) {
      const factor = 0.45 / (luminance + 0.05);
      return rgbToHex(r * factor, g * factor, b * factor);
    }
  }

  return hexColor;
}
