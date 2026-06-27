import { supabaseAdmin } from "../config/supabase";

export type RentalStatus = "pending" | "accepted" | "rejected" | "active" | "completed";

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
  tool?: { name: string; image: string };
  company?: { name: string };
  customer?: { name: string };
}

export const RentalModel = {
  async create(rental: Omit<Rental, "id" | "created_at" | "rating" | "tool" | "company" | "customer">): Promise<Rental> {
    // 1. Decrement tool quantity in database
    const { data: toolData, error: toolFetchError } = await supabaseAdmin
      .from("tools")
      .select("quantity, available")
      .eq("id", rental.tool_id)
      .single();

    if (!toolFetchError && toolData) {
      const newQuantity = Math.max(0, (toolData.quantity || 1) - 1);
      const isAvailable = newQuantity > 0;
      await supabaseAdmin
        .from("tools")
        .update({ quantity: newQuantity, available: isAvailable })
        .eq("id", rental.tool_id);
    }

    // 2. Create the rental record
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .insert({ ...rental, rating: null })
      .select("*, tool:tools(name, image), company:companies(name), customer:users(name)")
      .single();
    if (error) throw new Error(error.message);
    return data as Rental;
  },

  async findByCustomer(customerId: string): Promise<Rental[]> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select("*, tool:tools(name, image), company:companies(name), customer:users(name)")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Rental[];
  },

  async findByCompany(companyId: string): Promise<Rental[]> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select("*, tool:tools(name, image), company:companies(name), customer:users(name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Rental[];
  },

  async updateStatus(id: string, status: RentalStatus): Promise<Rental> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .update({ status })
      .eq("id", id)
      .select("*, tool:tools(name, image), company:companies(name), customer:users(name)")
      .single();
    if (error) throw new Error(error.message);
    return data as Rental;
  },

  async setRating(id: string, rating: number): Promise<Rental> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .update({ rating })
      .eq("id", id)
      .select("*, tool:tools(name, image), company:companies(name), customer:users(name)")
      .single();
    if (error) throw new Error(error.message);
    return data as Rental;
  },
};
