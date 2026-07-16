import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useThemeContext } from "./theme-provider";
import { CartItem, Company, ProfileType, Rental, RentalStatus, SessionUser, Tool, Deliverer } from "./types";
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
  deleteTool,
  getDeliverersByCompany,
  createDeliverer,
  updateDeliverer as apiUpdateDeliverer,
  deleteDeliverer as apiDeleteDeliverer,
  getDelivererRentals
} from "./api";

interface AppState {
  companies: Company[];
  tools: Tool[];
  cart: CartItem[];
  rentals: Rental[];
  deliverers: Deliverer[];
  user: SessionUser | null;
  addToCart: (tool: Tool, companyName: string) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartDays: (cartItemId: string, days: number) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  login: (
    email: string,
    name: string,
    profile: ProfileType,
    password?: string,
    isRegister?: boolean,
    cpf?: string,
    phone?: string,
    cnpj?: string,
    state?: string,
    city?: string
  ) => Promise<any>;
  logout: () => void;
  checkout: () => Promise<void>;
  rateRental: (rentalId: string, rating: number, comment?: string) => void;
  setRentalStatus: (rentalId: string, status: RentalStatus, receiverName?: string, receiverCpf?: string) => void;
  addTool: (tool: Omit<Tool, "id">) => void;
  updateTool: (tool: Tool) => void;
  deleteTool: (toolId: string) => void;
  addDeliverer: (deliverer: { name: string; email: string; phone: string; password?: string }) => Promise<void>;
  updateDeliverer: (id: string, deliverer: Partial<Pick<Deliverer, "name" | "email" | "phone" | "active">>) => Promise<void>;
  deleteDeliverer: (id: string) => Promise<void>;
  cartTotal: number;
  refreshCatalog: () => Promise<void>;
  refreshRentals: () => Promise<void>;
  refreshDeliverers: () => Promise<void>;
  updateAvatar: (avatarUrl: string, primaryColor?: string, secondaryColor?: string) => Promise<void>;
  updateCompanyStatus: (isOpen: boolean) => Promise<void>;
  checkSession: () => Promise<void>;
  isHydrated: boolean;
}

const AppContext = createContext<AppState | null>(null);

const STORAGE_KEY = "@AlugaTools_state_v2";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [deliverers, setDeliverers] = useState<Deliverer[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const { setPrimaryColor, setSecondaryColor } = useThemeContext();

  useEffect(() => {
    if (user && (user.profile === "company" || user.profile === "deliverer")) {
      setPrimaryColor(user.primaryColor || null);
      setSecondaryColor(user.secondaryColor || null);
    } else {
      setPrimaryColor(null);
      setSecondaryColor(null);
    }
  }, [user, setPrimaryColor, setSecondaryColor]);

  // 1. Hydrate cart and user session from storage on load
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.cart) {
            const sanitized = parsed.cart.map((item: any) => ({
              ...item,
              id: item.id || Math.random().toString(36).substring(2, 9),
              quantity: item.quantity || 1,
            }));
            setCart(sanitized);
          }
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
      } else if (user.profile === "deliverer") {
        list = await getDelivererRentals();
      } else {
        list = await getMyRentals();
      }
      setRentals(list);

      // Notify company/deliverer of return_expired and near-expiry rentals
      if (user.profile === "company" || user.profile === "deliverer") {
        const now = Date.now();
        const twoHoursMs = 2 * 60 * 60 * 1000;

        const returnExpired = list.filter((r) => r.status === "return_expired");
        const nearExpiry = list.filter((r) => {
          if (r.status !== "delivered" && r.status !== "active") return false;
          if (!r.deliveredAt) return false;
          const expiresAt = r.deliveredAt + r.days * 24 * 60 * 60 * 1000;
          const timeLeft = expiresAt - now;
          return timeLeft > 0 && timeLeft <= twoHoursMs;
        });

        if (returnExpired.length > 0) {
          const names = returnExpired.map((r) => r.toolName).join(", ");
          Alert.alert(
            "⚠️ Pedidos para Devolução",
            `${returnExpired.length} pedido(s) aguardando devolução: ${names}. Por favor, confirme o recebimento.`
          );
        } else if (nearExpiry.length > 0) {
          const names = nearExpiry.map((r) => r.toolName).join(", ");
          Alert.alert(
            "⏰ Aluguéis próximos de expirar",
            `${nearExpiry.length} aluguel(is) expira(m) em menos de 2 horas: ${names}.`
          );
        }
      }
    } catch (err) {
      console.error("Erro ao carregar aluguéis:", err);
    }
  }, [user]);

  useEffect(() => {
    loadRentals();
  }, [loadRentals]);

  // 4b. Load deliverers list whenever user changes
  const loadDeliverers = useCallback(async () => {
    if (!user || user.profile !== "company" || !user.companyId) {
      setDeliverers([]);
      return;
    }
    try {
      const list = await getDeliverersByCompany(user.companyId);
      setDeliverers(list);
    } catch (err) {
      console.error("Erro ao carregar entregadores:", err);
    }
  }, [user]);

  useEffect(() => {
    loadDeliverers();
  }, [loadDeliverers]);

  // Cart operations
  const addToCart = useCallback((tool: Tool, companyName: string) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.tool.id === tool.id);
      if (existingIndex > -1) {
        return prev.map((item, index) => {
          if (index === existingIndex) {
            const maxQty = tool.quantity || 1;
            const newQty = Math.min(maxQty, (item.quantity || 1) + 1);
            return { ...item, quantity: newQty };
          }
          return item;
        });
      } else {
        const initialDays = Math.max(1, tool.minDays || 1);
        const newItem: CartItem = {
          id: Math.random().toString(36).substring(2, 9),
          tool,
          companyName,
          days: initialDays,
          quantity: 1,
        };
        return [...prev, newItem];
      }
    });
  }, []);

  const removeFromCart = useCallback((cartItemId: string) => {
    setCart((prev) => prev.filter((i) => !(i.id === cartItemId || (!i.id && i.tool.id === cartItemId))));
  }, []);

  const updateCartDays = useCallback((cartItemId: string, days: number) => {
    setCart((prev) => prev.map((i) => {
      const match = i.id === cartItemId || (!i.id && i.tool.id === cartItemId);
      if (!match) return i;
      const minD = i.tool.minDays || 1;
      const maxD = i.tool.maxDays || 30;
      return { ...i, days: Math.min(maxD, Math.max(minD, days)) };
    }));
  }, []);

  const updateCartQuantity = useCallback((cartItemId: string, quantity: number) => {
    setCart((prev) => prev.map((i) => {
      const match = i.id === cartItemId || (!i.id && i.tool.id === cartItemId);
      if (!match) return i;
      const maxQty = i.tool.quantity || 1;
      return { ...i, quantity: Math.min(maxQty, Math.max(1, quantity)) };
    }));
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
    cnpj?: string,
    state?: string,
    city?: string
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
            state,
            city,
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
      return response.user;
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

  const checkSession = useCallback(async () => {
    try {
      const response = await apiCall<{ user: SessionUser }>("/api/auth/me");
      if (response.user) {
        setUser(response.user);
      }
    } catch (err) {
      console.error("Erro ao verificar sessão:", err);
    }
  }, []);

  const updateAvatar = useCallback(async (avatarUrl: string, primaryColor?: string, secondaryColor?: string) => {
    try {
      const res = await apiCall<{ user: any }>("/api/auth/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl, primaryColor, secondaryColor }),
      });
      if (res.user) {
        setUser((prev) => prev ? { 
          ...prev, 
          avatarUrl: res.user.avatarUrl || res.user.avatar_url,
          primaryColor: res.user.primaryColor || res.user.primary_color,
          secondaryColor: res.user.secondaryColor || res.user.secondary_color,
        } : null);
        await loadCatalog();
      }
    } catch (err) {
      console.error("Erro ao atualizar avatar:", err);
      throw err;
    }
  }, [loadCatalog]);

  const updateCompanyStatus = useCallback(async (isOpen: boolean) => {
    if (!user?.companyId) return;
    try {
      await apiCall<{ data: any }>(`/api/companies/${user.companyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_open: isOpen }),
      });
      await loadCatalog();
    } catch (err) {
      console.error("Erro ao atualizar status da empresa:", err);
      throw err;
    }
  }, [user, loadCatalog]);

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

  const handleRateRental = useCallback(async (rentalId: string, rating: number, comment?: string) => {
    try {
      await rateRental(rentalId, rating, comment);

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

  const handleSetRentalStatus = useCallback(async (rentalId: string, status: RentalStatus, receiverName?: string, receiverCpf?: string) => {
    try {
      await updateRentalStatus(rentalId, status, receiverName, receiverCpf);

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

  // Deliverer management
  const handleAddDeliverer = useCallback(async (deliv: { name: string; email: string; phone: string; password?: string }) => {
    if (!user?.companyId) return;
    try {
      await createDeliverer({ ...deliv, companyId: user.companyId });
      await loadDeliverers();
    } catch (err: any) {
      console.error("Erro ao adicionar entregador:", err);
      alert(err.message || "Erro ao adicionar entregador");
    }
  }, [user, loadDeliverers]);

  const handleUpdateDeliverer = useCallback(async (id: string, deliv: Partial<Pick<Deliverer, "name" | "email" | "phone" | "active">>) => {
    try {
      await apiUpdateDeliverer(id, deliv);
      await loadDeliverers();
    } catch (err: any) {
      console.error("Erro ao atualizar entregador:", err);
      alert(err.message || "Erro ao atualizar entregador");
    }
  }, [loadDeliverers]);

  const handleDeleteDeliverer = useCallback(async (id: string) => {
    try {
      await apiDeleteDeliverer(id);
      await loadDeliverers();
    } catch (err: any) {
      console.error("Erro ao deletar entregador:", err);
      alert(err.message || "Erro ao deletar entregador");
    }
  }, [loadDeliverers]);

  const refreshDeliverers = useCallback(async () => {
    await loadDeliverers();
  }, [loadDeliverers]);

  const cartTotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.tool.pricePerDay * i.days * (i.quantity || 1), 0),
    [cart],
  );

  const value = useMemo<AppState>(
    () => ({
      companies,
      tools,
      cart,
      rentals,
      deliverers,
      user,
      addToCart,
      removeFromCart,
      updateCartDays,
      updateCartQuantity,
      clearCart,
      login,
      logout,
      checkout,
      rateRental: handleRateRental,
      setRentalStatus: handleSetRentalStatus,
      addTool: handleAddTool,
      updateTool: handleUpdateTool,
      deleteTool: handleDeleteTool,
      addDeliverer: handleAddDeliverer,
      updateDeliverer: handleUpdateDeliverer,
      deleteDeliverer: handleDeleteDeliverer,
      cartTotal,
      refreshCatalog,
      refreshRentals,
      refreshDeliverers,
      updateAvatar,
      updateCompanyStatus,
      checkSession,
      isHydrated: hydrated,
    }),
    [
      companies,
      tools,
      cart,
      rentals,
      deliverers,
      user,
      addToCart,
      removeFromCart,
      updateCartDays,
      updateCartQuantity,
      clearCart,
      login,
      logout,
      checkout,
      handleRateRental,
      handleSetRentalStatus,
      handleAddTool,
      handleUpdateTool,
      handleDeleteTool,
      handleAddDeliverer,
      handleUpdateDeliverer,
      handleDeleteDeliverer,
      cartTotal,
      refreshCatalog,
      refreshRentals,
      refreshDeliverers,
      updateAvatar,
      updateCompanyStatus,
      checkSession,
      hydrated,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
