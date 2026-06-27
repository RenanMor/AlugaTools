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
}

export const RentalModel = {
  async create(rental: Omit<Rental, "id" | "created_at" | "rating">): Promise<Rental> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .insert({ ...rental, rating: null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Rental;
  },

  async findByCustomer(customerId: string): Promise<Rental[]> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select("*")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Rental[];
  },

  async findByCompany(companyId: string): Promise<Rental[]> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .select("*")
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
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Rental;
  },

  async setRating(id: string, rating: number): Promise<Rental> {
    const { data, error } = await supabaseAdmin
      .from("rentals")
      .update({ rating })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Rental;
  },
};
