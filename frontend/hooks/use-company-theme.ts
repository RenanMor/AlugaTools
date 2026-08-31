import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { useThemeContext } from "@/lib/theme-provider";
import { useApp } from "@/lib/app-context";
import { extractPalette } from "@/lib/utils";
import { Company } from "@/lib/types";

/**
 * Hook that applies a company's brand colors to the global theme
 * when the screen is focused, and restores the logged-in company's colors on blur/exit.
 */
export function useCompanyTheme(company: Company | null | undefined) {
  const { setPrimaryColor, setSecondaryColor } = useThemeContext();
  const { user, companies } = useApp();

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const applyTheme = async () => {
        if (!company) return;
        if (company.primaryColor) {
          if (active) {
            setPrimaryColor(company.primaryColor);
            if (company.secondaryColor) setSecondaryColor(company.secondaryColor);
          }
        } else if (company.logo) {
          try {
            const palette = await extractPalette(company.logo);
            if (active) {
              setPrimaryColor(palette.primary);
              setSecondaryColor(palette.secondary);
            }
          } catch (e) {
            console.warn("Could not extract company palette:", e);
          }
        }
      };

      applyTheme();

      return () => {
        active = false;
        // Restore logged-in user's own brand colors on cleanup
        if (user && (user.profile === "company" || user.profile === "deliverer")) {
          const myComp = companies.find(
            (c) => c.id === (user.companyId || user.delivererCompanyId) || (user.id && (c as any).owner_id === user.id)
          );
          const restorePrim = user.primaryColor || myComp?.primaryColor || null;
          const restoreSec = user.secondaryColor || myComp?.secondaryColor || null;

          if (restorePrim) {
            setPrimaryColor(restorePrim);
            setSecondaryColor(restoreSec || restorePrim);
          } else {
            const logo = user.avatarUrl || myComp?.logo;
            if (logo) {
              extractPalette(logo).then((palette) => {
                setPrimaryColor(palette.primary);
                setSecondaryColor(palette.secondary);
              }).catch(() => {
                setPrimaryColor(null);
                setSecondaryColor(null);
              });
            } else {
              setPrimaryColor(null);
              setSecondaryColor(null);
            }
          }
        } else {
          setPrimaryColor(null);
          setSecondaryColor(null);
        }
      };
    }, [
      company?.id,
      company?.logo,
      company?.primaryColor,
      company?.secondaryColor,
      user?.id,
      user?.profile,
      user?.avatarUrl,
      user?.primaryColor,
      user?.secondaryColor,
      user?.companyId,
      user?.delivererCompanyId,
      companies,
      setPrimaryColor,
      setSecondaryColor,
    ])
  );
}
