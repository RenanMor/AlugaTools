import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CartItem, Company, ProfileType, Rental, RentalStatus, SessionUser, Tool } from "./types";
import * as Auth from "./_core/auth";
import { apiCall } from "./_core/api";
import {
  getFeaturedCompanies,
  getAllTools,
  getMyRentals,
  getRentalsByCompany,
  createRental,
  updateRentalStatus,
  rateRental,
  createTool,
  updateTool,
  deleteTool
} from "./api";

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
  login: (
    email: string,
    name: string,
    profile: ProfileType,
    password?: string,
    isRegister?: boolean,
    cpf?: string,
    phone?: string,
    cnpj?: string
  ) => Promise<void>;
  logout: () => void;
  checkout: () => Promise<void>;
  rateRental: (rentalId: string, rating: number) => void;
  setRentalStatus: (rentalId: string, status: RentalStatus) => void;
  addTool: (tool: Omit<Tool, "id">) => void;
  updateTool: (tool: Tool) => void;
  deleteTool: (toolId: string) => void;
  cartTotal: number;
  refreshCatalog: () => Promise<void>;
  refreshRentals: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

const STORAGE_KEY = "@AlugaTools_state_v2";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // 1. Hydrate cart and user session from storage on load
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.cart) setCart(parsed.cart);
          if (parsed.user) setUser(parsed.user);
        }
      } catch (err) {
        console.error("Erro ao hidratar estado local:", err);
      }
      setHydrated(true);
    })();
  }, []);

  // 2. Persist cart and user session to storage
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ cart, user })).catch(() => { });
  }, [cart, user, hydrated]);

  // 3. Load catalog (companies & tools) from API on mount
  const loadCatalog = useCallback(async () => {
    try {
      const [comps, tls] = await Promise.all([
        getFeaturedCompanies(),
        getAllTools()
      ]);
      setCompanies(comps);
      setTools(tls);
    } catch (err) {
      console.error("Erro ao carregar dados do catálogo:", err);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  // 4. Load rentals list whenever user state changes
  const loadRentals = useCallback(async () => {
    if (!user) {
      setRentals([]);
      return;
    }
    try {
      let list: Rental[] = [];
      if (user.profile === "company" && user.companyId) {
        list = await getRentalsByCompany(user.companyId);
      } else {
        list = await getMyRentals();
      }
      setRentals(list);
    } catch (err) {
      console.error("Erro ao carregar aluguéis:", err);
    }
  }, [user]);

  useEffect(() => {
    loadRentals();
  }, [loadRentals]);

  // Cart operations
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

  // Authentication operations
  const login = useCallback(async (
    email: string,
    name: string,
    profile: ProfileType,
    password?: string,
    isRegister?: boolean,
    cpf?: string,
    phone?: string,
    cnpj?: string
  ) => {
    try {
      let response: any;
      if (isRegister) {
        response = await apiCall<{ token: string; user: SessionUser }>("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password: password || "123456",
            name,
            profile,
            cpf: cpf ? cpf.replace(/\D/g, "") : undefined,
            cnpj: cnpj ? cnpj.replace(/\D/g, "") : undefined,
            phone: phone ? phone.replace(/\D/g, "") : "",
          }),
        });
      } else {
        response = await apiCall<{ token: string; user: SessionUser }>("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password: password || "123456",
            cpf: cpf ? cpf.replace(/\D/g, "") : undefined,
            cnpj: cnpj ? cnpj.replace(/\D/g, "") : undefined,
            profile,
          }),
        });
      }

      if (response.token) {
        await Auth.setSessionToken(response.token);
      }
      setUser(response.user);
    } catch (err) {
      console.error("Erro de autenticação:", err);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Auth.removeSessionToken();
      setUser(null);
      setRentals([]);
    } catch (err) {
      console.error("Erro ao deslogar:", err);
    }
  }, []);

  const refreshCatalog = useCallback(async () => {
    await loadCatalog();
  }, [loadCatalog]);

  const refreshRentals = useCallback(async () => {
    await loadRentals();
  }, [loadRentals]);

  // Rental operations (Legacy context helper - actual checkout happens on the checkout screen)
  const checkout = useCallback(async () => {
    if (cart.length === 0 || !user) return;
    try {
      clearCart();
      await Promise.all([loadCatalog(), loadRentals()]);
    } catch (err) {
      console.error("Erro no checkout:", err);
      throw err;
    }
  }, [cart, user, clearCart, loadCatalog, loadRentals]);

  const handleRateRental = useCallback(async (rentalId: string, rating: number) => {
    try {
      await rateRental(rentalId, rating);

      // Refresh rentals and company ratings
      const [comps, rents] = await Promise.all([
        getFeaturedCompanies(),
        user?.profile === "company" && user.companyId ? getRentalsByCompany(user.companyId) : getMyRentals(),
      ]);
      setCompanies(comps);
      setRentals(rents);
    } catch (err) {
      console.error("Erro ao avaliar aluguel:", err);
    }
  }, [user]);

  const handleSetRentalStatus = useCallback(async (rentalId: string, status: RentalStatus) => {
    try {
      await updateRentalStatus(rentalId, status);

      // Refresh rentals
      let list: Rental[] = [];
      if (user?.profile === "company" && user.companyId) {
        list = await getRentalsByCompany(user.companyId);
      } else {
        list = await getMyRentals();
      }
      setRentals(list);
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
    }
  }, [user]);

  // Tool management
  const handleAddTool = useCallback(async (tool: Omit<Tool, "id">) => {
    try {
      await createTool(tool);
      const tls = await getAllTools();
      setTools(tls);
    } catch (err: any) {
      console.error("Erro ao adicionar ferramenta:", err);
      alert(err.message || "Erro ao adicionar ferramenta");
    }
  }, []);

  const handleUpdateTool = useCallback(async (tool: Tool) => {
    try {
      await updateTool(tool.id, tool);
      const tls = await getAllTools();
      setTools(tls);
    } catch (err: any) {
      console.error("Erro ao atualizar ferramenta:", err);
      alert(err.message || "Erro ao atualizar ferramenta");
    }
  }, []);

  const handleDeleteTool = useCallback(async (toolId: string) => {
    try {
      await deleteTool(toolId);
      const tls = await getAllTools();
      setTools(tls);
    } catch (err: any) {
      console.error("Erro ao deletar ferramenta:", err);
      alert(err.message || "Erro ao deletar ferramenta");
    }
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
      rateRental: handleRateRental,
      setRentalStatus: handleSetRentalStatus,
      addTool: handleAddTool,
      updateTool: handleUpdateTool,
      deleteTool: handleDeleteTool,
      cartTotal,
      refreshCatalog,
      refreshRentals,
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
      handleRateRental,
      handleSetRentalStatus,
      handleAddTool,
      handleUpdateTool,
      handleDeleteTool,
      cartTotal,
      refreshCatalog,
      refreshRentals,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
