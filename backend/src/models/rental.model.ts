import { supabaseAdmin } from "../config/supabase";

export type RentalStatus = "awaiting_payment" | "pending" | "accepted" | "rejected" | "delivering" | "delivered" | "active" | "completed" | "cancelled";

const SELECT_FIELDS = "*, tool:tools(name, image), company:companies(name), customer:users(name), deliverer:deliverers(name)";

export interface Rental {
  id: string;
  tool_id: string;
  company_id: string;
  customer_id: string;
  days: number;
  total_price: number;
  status: RentalStatus;
  rating: number | null;
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
    };

    console.log("[RentalModel.create] Inserting rental:", JSON.stringify(insertData));

    const { data, error } = await supabaseAdmin
      .from("rentals")
      .insert(insertData)
      .select(SELECT_FIELDS)
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
      .select(SELECT_FIELDS)
      .eq("id", id)
      .single();
    if (error) return null;
    return data as Rental;
  },

  async findByCustomer(customerId: string): Promise<Rental[]> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select(SELECT_FIELDS)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Rental[];
  },

  async findByCompany(companyId: string): Promise<Rental[]> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select(SELECT_FIELDS)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Rental[];
  },

  async updateStatus(id: string, status: RentalStatus, extras?: { deliverer_id?: string }): Promise<Rental> {
    const updateData: any = { status };
    if (status === "delivered") {
      updateData.delivered_at = new Date().toISOString();
    }
    if (extras?.deliverer_id) {
      updateData.deliverer_id = extras.deliverer_id;
    }
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .update(updateData)
      .eq("id", id)
      .select(SELECT_FIELDS)
      .single();
    if (error) throw new Error(error.message);
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
      .select(SELECT_FIELDS)
      .single();
    if (error) throw new Error(error.message);
    return data as Rental;
  },

  async setRating(id: string, rating: number): Promise<Rental> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .update({ rating })
      .eq("id", id)
      .select(SELECT_FIELDS)
      .single();
    if (error) throw new Error(error.message);
    return data as Rental;
  },

  /**
   * Cancel expired rentals (awaiting_payment past expires_at) and restore stock.
   */
  async cancelExpired(): Promise<number> {
    // Find all expired awaiting_payment rentals
    const { data: expired, error } = await supabaseAdmin
      .from("rentals")
      .select("id, tool_id")
      .eq("status", "awaiting_payment")
      .lt("expires_at", new Date().toISOString());

    if (error || !expired || expired.length === 0) return 0;

    let cancelledCount = 0;

    for (const rental of expired) {
      // Cancel the rental
      await supabaseAdmin
        .from("rentals")
        .update({ status: "cancelled" })
        .eq("id", rental.id);

      // Restore tool quantity
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

      cancelledCount++;
    }

    if (cancelledCount > 0) {
      console.log(`[Cleanup] Cancelled ${cancelledCount} expired rental(s) and restored stock.`);
    }

    return cancelledCount;
  },

  /**
   * Cancel a specific rental and restore stock.
   */
  async cancelAndRestore(id: string): Promise<Rental> {
    const rental = await this.findById(id);
    if (!rental) throw new Error("Pedido não encontrado");

    if (rental.status !== "awaiting_payment") {
      throw new Error("Apenas pedidos aguardando pagamento podem ser cancelados");
    }

    // Restore tool quantity
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

    // Update rental status
    return this.updateStatus(id, "cancelled");
  },
};
