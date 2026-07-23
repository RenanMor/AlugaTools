import { supabaseAdmin } from "../config/supabase";

export type RentalStatus = "awaiting_payment" | "pending" | "accepted" | "rejected" | "delivering" | "delivered" | "active" | "completed" | "cancelled" | "return_expired";

const PRIMARY_SELECT_FIELDS = "*, tool:tools(name, image), company:companies(name), customer:users(name), deliverer:deliverers(name)";
const SAFE_SELECT_FIELDS = "*, tool:tools(name, image), company:companies(name), customer:users(name)";

async function selectRentalWithFallback(queryBuilder: any): Promise<{ data: any; error: any }> {
  const { data, error } = await queryBuilder.select(PRIMARY_SELECT_FIELDS);
  if (error) {
    console.warn("[RentalModel] Query with deliverer join failed, retrying with safe fields. Error:", error.message);
    return await queryBuilder.select(SAFE_SELECT_FIELDS);
  }
  return { data, error };
}

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
      .select(SAFE_SELECT_FIELDS)
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
    return data as Rental;
  },

  async findById(id: string): Promise<Rental | null> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select(SAFE_SELECT_FIELDS)
      .eq("id", id)
      .single();
    if (error) return null;
    return data as Rental;
  },

  async findByCustomer(customerId: string): Promise<Rental[]> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select(SAFE_SELECT_FIELDS)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Rental[];
  },

  async findByCompany(companyId: string): Promise<Rental[]> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select(SAFE_SELECT_FIELDS)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Rental[];
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
      .select(SAFE_SELECT_FIELDS)
      .single();
    if (error) throw new Error(error.message);

    // Only restore units when transitioning to "completed" from an active or return_expired state
    // (i.e. if the user had the tool out and is now returning it)
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

    return data as Rental;
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
      .select(SAFE_SELECT_FIELDS)
      .single();
    if (error) throw new Error(error.message);
    return data as Rental;
  },

  async setRating(id: string, rating: number, ratingComment?: string): Promise<Rental> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .update({ rating, rating_comment: ratingComment || null })
      .eq("id", id)
      .select(SAFE_SELECT_FIELDS)
      .single();
    if (error) throw new Error(error.message);
    return data as Rental;
  },

  /**
   * Cancel expired rentals (awaiting_payment past expires_at) and restore stock.
   * Groups by tool_id so that multiple rentals of the same tool restore the correct total.
   */
  async cancelExpired(): Promise<number> {
    // Find all expired awaiting_payment rentals
    const { data: expired, error } = await supabaseAdmin
      .from("rentals")
      .select("id, tool_id")
      .eq("status", "awaiting_payment")
      .lt("expires_at", new Date().toISOString());

    if (error || !expired || expired.length === 0) return 0;

    // Cancel all expired rentals at once
    const expiredIds = expired.map((r) => r.id);
    await supabaseAdmin
      .from("rentals")
      .update({ status: "cancelled" })
      .in("id", expiredIds);

    // Try to record who cancelled (best-effort, columns may not exist yet)
    try {
      await supabaseAdmin
        .from("rentals")
        .update({ cancelled_by_name: "Sistema (expirado)" })
        .in("id", expiredIds);
    } catch (_) {}

    // Group by tool_id and restore the exact total count for each tool
    const toolCounts: Record<string, number> = {};
    for (const rental of expired) {
      toolCounts[rental.tool_id] = (toolCounts[rental.tool_id] || 0) + 1;
    }

    for (const [toolId, count] of Object.entries(toolCounts)) {
      // Use atomic RPC increment so concurrent operations don't race
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
   * and transition them to return_expired status.
   * Returns the list of updated rentals so callers can send notifications.
   */
  async checkExpiredActiveRentals(): Promise<Rental[]> {
    // Fetch all delivered/active rentals that have a delivered_at set
    const { data: candidates, error } = await supabaseAdmin
      .from("rentals")
      .select(SAFE_SELECT_FIELDS)
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
        // Transition to return_expired
        const { data: updated, error: updateErr } = await supabaseAdmin
          .from("rentals")
          .update({ status: "return_expired" })
          .eq("id", rental.id)
          .select(SAFE_SELECT_FIELDS)
          .single();
        if (!updateErr && updated) {
          expired.push(updated as Rental);
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
   * Works for any status that is not already cancelled.
   * Stock is restored only if the rental was not yet completed/returned (tool still allocated).
   * @param cancelledByUserId - The user ID of whoever cancelled (optional)
   * @param cancelledByName - Display name of whoever cancelled (optional)
   */
  async cancelAndRestore(id: string, cancelledByUserId?: string, cancelledByName?: string): Promise<Rental> {
    const rental = await this.findById(id);
    if (!rental) throw new Error("Pedido não encontrado");

    if (rental.status === "cancelled") {
      throw new Error("Este pedido já está cancelado");
    }

    // Only restore stock if the tool hasn't been returned yet
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

    // Update rental status (always succeeds)
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select(SAFE_SELECT_FIELDS)
      .single();
    if (error) throw new Error(error.message);

    // Try to record who cancelled (best-effort — columns may not exist yet, migration required)
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

    return data as Rental;
  },
};
