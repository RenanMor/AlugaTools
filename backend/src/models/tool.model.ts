import { supabaseAdmin } from "../config/supabase";

export interface Tool {
  id: string;
  company_id: string;
  name: string;
  description: string;
  category_id: string;
  image: string;
  price_per_day: number;
  available: boolean;
  quantity: number;
}

function mapRow(row: any): Tool {
  if (!row) return row;
  return {
    ...row,
    image: row.image || row.image_url || ""
  };
}

export const ToolModel = {
  async findAll(): Promise<Tool[]> {
    const { data, error } = await supabaseAdmin
      .from("tools")
      .select("*");
    if (error) throw new Error(error.message);
    return (data || []).map(mapRow);
  },

  async findById(id: string): Promise<Tool | null> {
    const { data, error } = await supabaseAdmin
      .from("tools")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return null;
    return mapRow(data);
  },

  async findByCompany(companyId: string): Promise<Tool[]> {
    const { data, error } = await supabaseAdmin
      .from("tools")
      .select("*")
      .eq("company_id", companyId);
    if (error) throw new Error(error.message);
    return (data || []).map(mapRow);
  },

  async create(tool: Omit<Tool, "id">): Promise<Tool> {
    // If the database has image_url, we adapt the payload to matching column structure
    const payload: any = { ...tool };
    
    const { data, error } = await supabaseAdmin
      .from("tools")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },

  async update(id: string, patch: Partial<Tool>): Promise<Tool> {
    const { data, error } = await supabaseAdmin
      .from("tools")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from("tools").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
