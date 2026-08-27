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
  state: string | null;
  city: string | null;
  is_open: boolean;
  owner_id: string;
  status: string;
  // Address fields for Asaas subaccount onboarding
  postal_code?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  neighborhood?: string | null;
  // Pix / Banking details for payouts
  pix_key_type?: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP" | null;
  pix_key?: string | null;
  bank_code?: string | null;
  bank_agency?: string | null;
  bank_account?: string | null;
  bank_account_digit?: string | null;
  bank_account_type?: "CONTA_CORRENTE" | "CONTA_POUPANCA" | null;
  bank_owner_name?: string | null;
  bank_cpf_cnpj?: string | null;
  // Asaas Subaccount & Split fields
  asaas_account_id: string | null;
  asaas_wallet_id: string | null;
  asaas_api_key: string | null;
  asaas_status?: "not_created" | "pending" | "active" | "error" | null;
  platform_fee_percent: number | null;
}

export const CompanyModel = {
  async findFeatured(limit = 10): Promise<Company[]> {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("*")
      .order("rating", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    // SECURITY FIX (LOW-01): Never expose non-approved companies as fallback
    const approved = (data || []).filter((c) => !c.status || c.status === "approved");
    return approved as Company[];
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
    // SECURITY FIX (LOW-01): Never expose non-approved companies as fallback
    const approved = (data || []).filter((c) => !c.status || c.status === "approved");
    return approved as Company[];
  },

  async findPending(): Promise<Company[]> {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Company[];
  },

  async findAll(): Promise<Company[]> {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("*, users(name, email, cnpj, cpf, phone, created_at)")
      .order("name", { ascending: true });
    if (error) {
      const { data: fallback, error: fallbackErr } = await supabaseAdmin
        .from("companies")
        .select("*")
        .order("name", { ascending: true });
      if (fallbackErr) throw new Error(fallbackErr.message);
      return fallback as Company[];
    }
    return (data || []).map((c: any) => ({
      ...c,
      owner_name: c.users?.name,
      owner_email: c.users?.email,
      cnpj: c.users?.cnpj,
      phone: c.users?.phone,
      owner_created_at: c.users?.created_at,
    })) as Company[];
  },

  async updateStatus(id: string, status: "approved" | "rejected"): Promise<Company> {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Company;
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

  /**
   * Save Asaas subaccount data for a company (after subaccount creation).
   */
  async updateAsaasData(companyId: string, data: {
    asaas_account_id?: string;
    asaas_wallet_id?: string;
    asaas_api_key?: string;
    asaas_status?: "not_created" | "pending" | "active" | "error";
    platform_fee_percent?: number;
  }): Promise<void> {
    const updatePayload: any = {};
    if (data.asaas_account_id !== undefined) updatePayload.asaas_account_id = data.asaas_account_id;
    if (data.asaas_wallet_id !== undefined) updatePayload.asaas_wallet_id = data.asaas_wallet_id;
    if (data.asaas_api_key !== undefined) updatePayload.asaas_api_key = data.asaas_api_key;
    if (data.asaas_status !== undefined) updatePayload.asaas_status = data.asaas_status;
    if (data.platform_fee_percent !== undefined) updatePayload.platform_fee_percent = data.platform_fee_percent;

    const { error } = await supabaseAdmin
      .from("companies")
      .update(updatePayload)
      .eq("id", companyId);
    if (error) {
      console.error("[CompanyModel.updateAsaasData] Error:", error);
      throw new Error(`Erro ao salvar dados Asaas da empresa: ${error.message}`);
    }
  },

  /**
   * Update banking and Pix payout details for a company.
   */
  async updateBankingData(companyId: string, data: {
    pix_key_type?: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP" | null;
    pix_key?: string | null;
    bank_code?: string | null;
    bank_agency?: string | null;
    bank_account?: string | null;
    bank_account_digit?: string | null;
    bank_account_type?: "CONTA_CORRENTE" | "CONTA_POUPANCA" | null;
    bank_owner_name?: string | null;
    bank_cpf_cnpj?: string | null;
  }): Promise<void> {
    const updatePayload: any = {};
    if (data.pix_key_type !== undefined) updatePayload.pix_key_type = data.pix_key_type;
    if (data.pix_key !== undefined) updatePayload.pix_key = data.pix_key;
    if (data.bank_code !== undefined) updatePayload.bank_code = data.bank_code;
    if (data.bank_agency !== undefined) updatePayload.bank_agency = data.bank_agency;
    if (data.bank_account !== undefined) updatePayload.bank_account = data.bank_account;
    if (data.bank_account_digit !== undefined) updatePayload.bank_account_digit = data.bank_account_digit;
    if (data.bank_account_type !== undefined) updatePayload.bank_account_type = data.bank_account_type;
    if (data.bank_owner_name !== undefined) updatePayload.bank_owner_name = data.bank_owner_name;
    if (data.bank_cpf_cnpj !== undefined) updatePayload.bank_cpf_cnpj = data.bank_cpf_cnpj;

    const { error } = await supabaseAdmin
      .from("companies")
      .update(updatePayload)
      .eq("id", companyId);
    if (error) {
      console.error("[CompanyModel.updateBankingData] Error:", error);
      throw new Error(`Erro ao salvar dados bancários da empresa: ${error.message}`);
    }
  },

  /**
   * Retrieve Asaas split configuration for a company.
   * Returns walletId + platform fee percent.
   */
  async getAsaasData(companyId: string): Promise<{
    asaas_wallet_id: string | null;
    platform_fee_percent: number | null;
    asaas_account_id: string | null;
    asaas_api_key: string | null;
    asaas_status: string | null;
  } | null> {
    const { data, error } = await supabaseAdmin
      .from("companies")
      .select("asaas_wallet_id, platform_fee_percent, asaas_account_id, asaas_api_key, asaas_status")
      .eq("id", companyId)
      .single();
    if (error || !data) return null;
    return data;
  },
};

