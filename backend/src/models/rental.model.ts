import { supabaseAdmin } from "../config/supabase";

export type RentalStatus = "awaiting_payment" | "pending" | "accepted" | "rejected" | "delivering" | "delivered" | "active" | "completed" | "cancelled" | "return_expired";

export interface Rental {
  id: string;
  tool_id: string;
  company_id: string;
  customer_id: string;
  days: number;
  total_price: number;
  status: RentalStatus;
  rating: number | null;
  rating_comment: string | null;
  created_at: string;
  payment_method: string | null;
  payment_id: string | null;
  payment_status: string | null;
  payment_data: any | null;
  expires_at: string | null;
  shipping_price: number;
  address: any | null;
  coupon_code: string | null;
  coupon_discount: number;
  deliverer_id: string | null;
  delivered_at: string | null;
  customer_note: string | null;
  receiver_name: string | null;
  receiver_cpf: string | null;
  cancelled_by: string | null;
  cancelled_by_name: string | null;
  tool?: { name: string; image: string };
  company?: { name: string };
  customer?: { name: string };
  deliverer?: { name: string };
}

export interface CreateRentalInput {
  tool_id: string;
  company_id: string;
  customer_id: string;
  days: number;
  total_price: number;
  status: RentalStatus;
  payment_method?: string;
  shipping_price?: number;
  address?: any;
  coupon_code?: string;
  coupon_discount?: number;
  expires_at?: string;
  customer_note?: string;
}

/**
 * Safely enriches rental objects with tool, company, customer, and deliverer details
 * without depending on PostgREST foreign key joins, preventing schema cache crashes.
 */
async function enrichRentals(rentals: any | any[]): Promise<any> {
  const isArray = Array.isArray(rentals);
  const list = isArray ? rentals : rentals ? [rentals] : [];
  if (list.length === 0) return isArray ? [] : null;

  const toolIds = Array.from(new Set(list.map((r: any) => r.tool_id).filter(Boolean)));
  const companyIds = Array.from(new Set(list.map((r: any) => r.company_id).filter(Boolean)));
  const customerIds = Array.from(new Set(list.map((r: any) => r.customer_id).filter(Boolean)));
  const delivererIds = Array.from(new Set(list.map((r: any) => r.deliverer_id).filter(Boolean)));

  const [toolsRes, companiesRes, usersRes, deliverersRes] = await Promise.all([
    toolIds.length ? supabaseAdmin.from("tools").select("id, name, image").in("id", toolIds) : Promise.resolve({ data: [] }),
    companyIds.length ? supabaseAdmin.from("companies").select("id, name").in("id", companyIds) : Promise.resolve({ data: [] }),
    customerIds.length ? supabaseAdmin.from("users").select("id, name").in("id", customerIds) : Promise.resolve({ data: [] }),
    delivererIds.length ? supabaseAdmin.from("deliverers").select("id, name").in("id", delivererIds) : Promise.resolve({ data: [] }),
  ]);

  const toolMap: Record<string, { name: string; image: string }> = {};
  (toolsRes.data || []).forEach((t: any) => { toolMap[t.id] = { name: t.name, image: t.image }; });

  const companyMap: Record<string, { name: string }> = {};
  (companiesRes.data || []).forEach((c: any) => { companyMap[c.id] = { name: c.name }; });

  const userMap: Record<string, { name: string }> = {};
  (usersRes.data || []).forEach((u: any) => { userMap[u.id] = { name: u.name }; });

  const delivererMap: Record<string, { name: string }> = {};
  (deliverersRes.data || []).forEach((d: any) => { delivererMap[d.id] = { name: d.name }; });

  const enriched = list.map((r: any) => ({
    ...r,
    tool: r.tool || toolMap[r.tool_id] || undefined,
    company: r.company || companyMap[r.company_id] || undefined,
    customer: r.customer || userMap[r.customer_id] || undefined,
    deliverer: r.deliverer || delivererMap[r.deliverer_id] || undefined,
  }));

  return isArray ? enriched : enriched[0];
}

export const RentalModel = {
  async create(rental: CreateRentalInput): Promise<Rental> {
    // 1. Decrement tool quantity in database (reserve stock)
    const { data: toolData, error: toolFetchError } = await supabaseAdmin
      .from("tools")
      .select("quantity, available")
      .eq("id", rental.tool_id)
      .single();

    if (toolFetchError) {
      console.error("[RentalModel.create] Tool fetch error:", toolFetchError);
      throw new Error("Ferramenta não encontrada");
    }

    if (!toolData || (toolData.quantity || 0) <= 0) {
      throw new Error("Ferramenta sem estoque disponível");
    }

    const originalQuantity = toolData.quantity || 1;
    const newQuantity = Math.max(0, originalQuantity - 1);
    const isAvailable = newQuantity > 0;
    await supabaseAdmin
      .from("tools")
      .update({ quantity: newQuantity, available: isAvailable })
      .eq("id", rental.tool_id);

    // 2. Create the rental record
    const insertData: any = {
      tool_id: rental.tool_id,
      company_id: rental.company_id,
      customer_id: rental.customer_id,
      days: rental.days,
      total_price: rental.total_price,
      status: rental.status,
      rating: null,
      payment_method: rental.payment_method || null,
      shipping_price: rental.shipping_price || 0,
      address: rental.address || null,
      coupon_code: rental.coupon_code || null,
      coupon_discount: rental.coupon_discount || 0,
      expires_at: rental.expires_at || null,
      customer_note: rental.customer_note || null,
    };

    console.log("[RentalModel.create] Inserting rental:", JSON.stringify(insertData));

    const { data, error } = await supabaseAdmin
      .from("rentals")
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      // ROLLBACK: restore stock so quantity is never consumed without a rental
      console.error("[RentalModel.create] INSERT failed — rolling back stock. Error:", error);
      await supabaseAdmin
        .from("tools")
        .update({ quantity: originalQuantity, available: true })
        .eq("id", rental.tool_id);
      throw new Error(`Erro ao criar pedido: ${error.message} (code: ${error.code})`);
    }

    console.log("[RentalModel.create] Rental created successfully:", data?.id);
    return (await enrichRentals(data)) as Rental;
  },

  async findById(id: string): Promise<Rental | null> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return (await enrichRentals(data)) as Rental;
  },

  async findByCustomer(customerId: string): Promise<Rental[]> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (await enrichRentals(data || [])) as Rental[];
  },

  async findByCompany(companyId: string): Promise<Rental[]> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (await enrichRentals(data || [])) as Rental[];
  },

  async updateStatus(
    id: string,
    status: RentalStatus,
    extras?: { deliverer_id?: string; receiver_name?: string; receiver_cpf?: string }
  ): Promise<Rental> {
    const rental = await this.findById(id);
    if (!rental) throw new Error("Pedido não encontrado");

    const oldStatus = rental.status;
    const updateData: any = { status };

    if (status === "delivered") {
      if (!rental.delivered_at) {
        updateData.delivered_at = new Date().toISOString();
      }
      if (extras?.receiver_name) {
        updateData.receiver_name = extras.receiver_name;
      }
      if (extras?.receiver_cpf) {
        updateData.receiver_cpf = extras.receiver_cpf;
      }
    }
    if (extras?.deliverer_id) {
      updateData.deliverer_id = extras.deliverer_id;
    }

    const { data, error } = await supabaseAdmin
      .from("rentals")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    // Only restore units when transitioning to "completed" from an active or return_expired state
    const wasActive = ["accepted", "delivering", "delivered", "active", "return_expired"].includes(oldStatus);
    if (status === "completed" && wasActive) {
      const { data: toolData } = await supabaseAdmin
        .from("tools")
        .select("quantity")
        .eq("id", rental.tool_id)
        .single();

      if (toolData) {
        const newQty = (toolData.quantity || 0) + 1;
        await supabaseAdmin
          .from("tools")
          .update({ quantity: newQty, available: true })
          .eq("id", rental.tool_id);
        console.log(`[Stock] Restored 1 unit for tool ${rental.tool_id} (Rental ${rental.id} completed).`);
      }
    }

    return (await enrichRentals(data)) as Rental;
  },

  async updatePayment(id: string, updates: {
    payment_id?: string;
    payment_status?: string;
    payment_data?: any;
    status?: RentalStatus;
  }): Promise<Rental> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .update(updates)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return (await enrichRentals(data)) as Rental;
  },

  async setRating(id: string, rating: number, ratingComment?: string): Promise<Rental> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .update({ rating, rating_comment: ratingComment || null })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return (await enrichRentals(data)) as Rental;
  },

  /**
   * Cancel expired rentals (awaiting_payment past expires_at) and restore stock.
   */
  async cancelExpired(): Promise<number> {
    const { data: expired, error } = await supabaseAdmin
      .from("rentals")
      .select("id, tool_id")
      .eq("status", "awaiting_payment")
      .lt("expires_at", new Date().toISOString());

    if (error || !expired || expired.length === 0) return 0;

    const expiredIds = expired.map((r) => r.id);
    await supabaseAdmin
      .from("rentals")
      .update({ status: "cancelled" })
      .in("id", expiredIds);

    try {
      await supabaseAdmin
        .from("rentals")
        .update({ cancelled_by_name: "Sistema (expirado)" })
        .in("id", expiredIds);
    } catch (_) {}

    const toolCounts: Record<string, number> = {};
    for (const rental of expired) {
      toolCounts[rental.tool_id] = (toolCounts[rental.tool_id] || 0) + 1;
    }

    for (const [toolId, count] of Object.entries(toolCounts)) {
      const { data: toolData } = await supabaseAdmin
        .from("tools")
        .select("quantity")
        .eq("id", toolId)
        .single();

      if (toolData) {
        const newQty = (toolData.quantity || 0) + count;
        await supabaseAdmin
          .from("tools")
          .update({ quantity: newQty, available: true })
          .eq("id", toolId);
      }
    }

    const cancelledCount = expired.length;
    if (cancelledCount > 0) {
      console.log(`[Cleanup] Cancelled ${cancelledCount} expired rental(s) and restored stock.`);
    }
    return cancelledCount;
  },

  /**
   * Detect active rentals (delivered/active) whose usage period has expired
   */
  async checkExpiredActiveRentals(): Promise<Rental[]> {
    const { data: candidates, error } = await supabaseAdmin
      .from("rentals")
      .select("*")
      .in("status", ["delivered", "active"])
      .not("delivered_at", "is", null);

    if (error || !candidates || candidates.length === 0) return [];

    const now = Date.now();
    const expired: Rental[] = [];

    for (const rental of candidates as Rental[]) {
      if (!rental.delivered_at) continue;
      const deliveredMs = new Date(rental.delivered_at).getTime();
      const usageLimitMs = deliveredMs + (rental.days || 1) * 24 * 60 * 60 * 1000;
      if (now >= usageLimitMs) {
        const { data: updated, error: updateErr } = await supabaseAdmin
          .from("rentals")
          .update({ status: "return_expired" })
          .eq("id", rental.id)
          .select("*")
          .single();
        if (!updateErr && updated) {
          const enriched = await enrichRentals(updated);
          expired.push(enriched as Rental);
        }
      }
    }

    if (expired.length > 0) {
      console.log(`[Cleanup] Marked ${expired.length} rental(s) as return_expired.`);
    }

    return expired;
  },

  /**
   * Cancel a specific rental and restore stock.
   */
  async cancelAndRestore(id: string, cancelledByUserId?: string, cancelledByName?: string): Promise<Rental> {
    const rental = await this.findById(id);
    if (!rental) throw new Error("Pedido não encontrado");

    if (rental.status === "cancelled") {
      throw new Error("Este pedido já está cancelado");
    }

    const shouldRestoreStock = rental.status !== "completed";

    if (shouldRestoreStock) {
      const { data: toolData } = await supabaseAdmin
        .from("tools")
        .select("quantity")
        .eq("id", rental.tool_id)
        .single();

      if (toolData) {
        const newQty = (toolData.quantity || 0) + 1;
        await supabaseAdmin
          .from("tools")
          .update({ quantity: newQty, available: true })
          .eq("id", rental.tool_id);
      }
    }

    const { data, error } = await supabaseAdmin
      .from("rentals")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (cancelledByUserId || cancelledByName) {
      const trackingUpdate: any = {};
      if (cancelledByUserId) trackingUpdate.cancelled_by = cancelledByUserId;
      if (cancelledByName) trackingUpdate.cancelled_by_name = cancelledByName;
      try {
        await supabaseAdmin
          .from("rentals")
          .update(trackingUpdate)
          .eq("id", id);
      } catch (_) {}
    }

    return (await enrichRentals(data)) as Rental;
  },
};

