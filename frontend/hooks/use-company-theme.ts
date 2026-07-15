import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useThemeContext } from "@/lib/theme-provider";
import { useApp } from "@/lib/app-context";
import { extractPalette } from "@/lib/utils";
import { Company } from "@/lib/types";

/**
 * Hook that applies a company's brand colors to the global theme
 * when the screen is focused, and restores the user's own colors on blur.
 *
 * Centralizes the duplicated logic from company/[id].tsx and tool/[id].tsx.
 *
 * Features:
 * - Reads company.primaryColor / secondaryColor from DB if available
 * - Falls back to extractPalette() from logo (with module-level cache)
 * - Restores user's own brand colors on cleanup (not null)
 * - Cancellable async via `active` flag
 */
export function useCompanyTheme(company: Company | null | undefined) {
  const { setPrimaryColor, setSecondaryColor } = useThemeContext();
  const { user } = useApp();

  useFocusEffect(
    useCallback(() => {
      let active = true;

      if (company) {
        if (company.primaryColor) {
          setPrimaryColor(company.primaryColor);
          if (company.secondaryColor) setSecondaryColor(company.secondaryColor);
        } else if (company.logo) {
          extractPalette(company.logo).then((palette) => {
            if (active) {
              setPrimaryColor(palette.primary);
              setSecondaryColor(palette.secondary);
            }
          });
        }
      }

      return () => {
        active = false;
        // Restore logged-in user's own brand colors (not null)
        setPrimaryColor(user?.primaryColor || null);
        setSecondaryColor(user?.secondaryColor || null);
      };
    }, [
      company?.logo,
      company?.primaryColor,
      company?.secondaryColor,
      user?.primaryColor,
      user?.secondaryColor,
      setPrimaryColor,
      setSecondaryColor,
    ])
  );
}
