import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { COMPANIES as SEED_COMPANIES, TOOLS as SEED_TOOLS } from "./data";
import { CartItem, Company, ProfileType, Rental, RentalStatus, SessionUser, Tool } from "./types";

interface AppState {
  companies: Company[];
  tools: Tool[];
  cart: CartItem[];
  rentals: Rental[];
  user: SessionUser | null;
  addToCart: (tool: Tool, companyName: string) => void;
  removeFromCart: (toolId: string) => void;
  updateCartDays: (toolId: string, days: number) => void;
  clearCart: () => void;
  login: (email: string, name: string, profile: ProfileType) => void;
  logout: () => void;
  checkout: () => void;
  rateRental: (rentalId: string, rating: number) => void;
  setRentalStatus: (rentalId: string, status: RentalStatus) => void;
  addTool: (tool: Omit<Tool, "id">) => void;
  updateTool: (tool: Tool) => void;
  deleteTool: (toolId: string) => void;
  cartTotal: number;
}

const AppContext = createContext<AppState | null>(null);

const STORAGE_KEY = "@renttools_state_v1";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>(SEED_COMPANIES);
  const [tools, setTools] = useState<Tool[]>(SEED_TOOLS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.tools) setTools(parsed.tools);
          if (parsed.cart) setCart(parsed.cart);
          if (parsed.rentals) setRentals(parsed.rentals);
          if (parsed.user) setUser(parsed.user);
        }
      } catch {}
      setHydrated(true);
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ tools, cart, rentals, user })).catch(() => {});
  }, [tools, cart, rentals, user, hydrated]);

  const recalcCompanyRating = useCallback((list: Rental[], companyId: string) => {
    const rated = list.filter((r) => r.companyId === companyId && typeof r.rating === "number");
    if (rated.length === 0) return;
    const avg = rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length;
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === companyId ? { ...c, rating: Math.round(avg * 10) / 10, ratingCount: c.ratingCount + 1 } : c,
      ),
    );
  }, []);

  const addToCart = useCallback((tool: Tool, companyName: string) => {
    setCart((prev) => {
      if (prev.some((i) => i.tool.id === tool.id)) return prev;
      return [...prev, { tool, companyName, days: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((toolId: string) => {
    setCart((prev) => prev.filter((i) => i.tool.id !== toolId));
  }, []);

  const updateCartDays = useCallback((toolId: string, days: number) => {
    setCart((prev) => prev.map((i) => (i.tool.id === toolId ? { ...i, days: Math.max(1, days) } : i)));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const login = useCallback((email: string, name: string, profile: ProfileType) => {
    setUser({
      id: "u_" + Date.now(),
      email,
      name,
      profile,
      companyId: profile === "company" ? "co1" : undefined,
    });
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const checkout = useCallback(() => {
    setCart((currentCart) => {
      if (currentCart.length === 0) return currentCart;
      const now = Date.now();
      setRentals((prev) => [
        ...currentCart.map((item, idx) => ({
          id: "r_" + now + "_" + idx,
          toolId: item.tool.id,
          toolName: item.tool.name,
          toolImage: item.tool.image,
          companyId: item.tool.companyId,
          companyName: item.companyName,
          customerName: "Cliente",
          days: item.days,
          totalPrice: item.tool.pricePerDay * item.days,
          status: "pending" as RentalStatus,
          createdAt: now,
        })),
        ...prev,
      ]);
      return [];
    });
  }, []);

  const rateRental = useCallback(
    (rentalId: string, rating: number) => {
      setRentals((prev) => {
        const updated = prev.map((r) => (r.id === rentalId ? { ...r, rating } : r));
        const target = updated.find((r) => r.id === rentalId);
        if (target) recalcCompanyRating(updated, target.companyId);
        return updated;
      });
    },
    [recalcCompanyRating],
  );

  const setRentalStatus = useCallback((rentalId: string, status: RentalStatus) => {
    setRentals((prev) => prev.map((r) => (r.id === rentalId ? { ...r, status } : r)));
  }, []);

  const addTool = useCallback((tool: Omit<Tool, "id">) => {
    setTools((prev) => [{ ...tool, id: "t_" + Date.now() }, ...prev]);
  }, []);

  const updateTool = useCallback((tool: Tool) => {
    setTools((prev) => prev.map((t) => (t.id === tool.id ? tool : t)));
  }, []);

  const deleteTool = useCallback((toolId: string) => {
    setTools((prev) => prev.filter((t) => t.id !== toolId));
  }, []);

  const cartTotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.tool.pricePerDay * i.days, 0),
    [cart],
  );

  const value = useMemo<AppState>(
    () => ({
      companies,
      tools,
      cart,
      rentals,
      user,
      addToCart,
      removeFromCart,
      updateCartDays,
      clearCart,
      login,
      logout,
      checkout,
      rateRental,
      setRentalStatus,
      addTool,
      updateTool,
      deleteTool,
      cartTotal,
    }),
    [
      companies,
      tools,
      cart,
      rentals,
      user,
      addToCart,
      removeFromCart,
      updateCartDays,
      clearCart,
      login,
      logout,
      checkout,
      rateRental,
      setRentalStatus,
      addTool,
      updateTool,
      deleteTool,
      cartTotal,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
