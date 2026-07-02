import { supabaseAdmin } from "../config/supabase";

export interface Deliverer {
  id: string;
  company_id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  created_at: string;
}

export interface CreateDelivererInput {
  company_id: string;
  user_id?: string;
  name: string;
  email: string;
  phone: string;
}

export const DelivererModel = {
  async create(input: CreateDelivererInput): Promise<Deliverer> {
    const { data, error } = await supabaseAdmin
      .from("deliverers")
      .insert({
        company_id: input.company_id,
        user_id: input.user_id || null,
        name: input.name,
        email: input.email,
        phone: input.phone,
        active: true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Deliverer;
  },

  async findByCompany(companyId: string): Promise<Deliverer[]> {
    const { data, error } = await supabaseAdmin
      .from("deliverers")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Deliverer[];
  },

  async findById(id: string): Promise<Deliverer | null> {
    const { data, error } = await supabaseAdmin
      .from("deliverers")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return data as Deliverer;
  },

  async findByUserId(userId: string): Promise<Deliverer | null> {
    const { data, error } = await supabaseAdmin
      .from("deliverers")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (error) return null;
    return data as Deliverer;
  },

  async update(id: string, updates: Partial<Pick<Deliverer, "name" | "email" | "phone" | "active">>): Promise<Deliverer> {
    const { data, error } = await supabaseAdmin
      .from("deliverers")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Deliverer;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("deliverers")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
};
