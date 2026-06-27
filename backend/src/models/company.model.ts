import { supabaseAdmin } from "../config/supabase";

export interface Company {
  id: string;
  name: string;
  logo: string;
  description: string;
  category_id: string;
  rating: number;
  rating_count: number;
  location: string;
  owner_id: string;
}

export const CompanyModel = {
  async findFeatured(limit = 10): Promise<Company[]> {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("*")
      .order("rating", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data as Company[];
  },

  async findById(id: string): Promise<Company | null> {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return data as Company;
  },

  async findByCategory(categoryId: string): Promise<Company[]> {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("category_id", categoryId);
    if (error) throw new Error(error.message);
    return data as Company[];
  },

  async recalcRating(companyId: string): Promise<void> {
    const { data: ratings, error } = await supabaseAdmin
      .from("rentals")
      .select("rating")
      .eq("company_id", companyId)
      .not("rating", "is", null);
    if (error) throw new Error(error.message);

    const values = (ratings ?? []).map((r: { rating: number }) => r.rating);
    if (values.length === 0) return;
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;

    await supabaseAdmin
      .from("companies")
      .update({ rating: Math.round(avg * 10) / 10, rating_count: values.length })
      .eq("id", companyId);
  },
};
