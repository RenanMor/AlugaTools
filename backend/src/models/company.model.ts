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
    // 1. Fetch all tools for this company
    const { data: tools, error: toolsError } = await supabaseAdmin
      .from("tools")
      .select("id")
      .eq("company_id", companyId);
    if (toolsError) throw new Error(toolsError.message);

    if (!tools || tools.length === 0) return;

    // 2. Fetch all rated rentals for these tools
    const toolIds = tools.map((t) => t.id);
    const { data: ratings, error: ratingsError } = await supabaseAdmin
      .from("rentals")
      .select("tool_id, rating")
      .in("tool_id", toolIds)
      .not("rating", "is", null);
    if (ratingsError) throw new Error(ratingsError.message);

    // 3. Compute average for each tool
    const toolRatings: Record<string, { sum: number; count: number }> = {};
    for (const r of (ratings ?? [])) {
      if (!toolRatings[r.tool_id]) {
        toolRatings[r.tool_id] = { sum: 0, count: 0 };
      }
      toolRatings[r.tool_id].sum += Number(r.rating);
      toolRatings[r.tool_id].count += 1;
    }

    const averages: number[] = [];
    let totalRatingsCount = 0;
    for (const tid of toolIds) {
      const rinfo = toolRatings[tid];
      if (rinfo) {
        averages.push(rinfo.sum / rinfo.count);
        totalRatingsCount += rinfo.count;
      }
    }

    // 4. Company rating is the average of the average rating of its rated tools
    if (averages.length === 0) return;
    const companyAvg = averages.reduce((a, b) => a + b, 0) / averages.length;

    await supabaseAdmin
      .from("companies")
      .update({ 
        rating: Math.round(companyAvg * 10) / 10, 
        rating_count: totalRatingsCount 
      })
      .eq("id", companyId);
  },
};
