import { apiCall } from "../_core/api";
import { Company, Rental } from "../types";
import { mapRental } from "./rentals";

function mapCompany(data: any): Company {
  return {
    id: data.id,
    name: data.name,
    logo: data.logo,
    description: data.description,
    categoryId: data.category_id,
    rating: Number(data.rating) || 0,
    ratingCount: Number(data.rating_count) || 0,
    location: data.location || "",
    state: data.state || undefined,
    city: data.city || undefined,
    isOpen: data.is_open,
    status: data.status,
    primaryColor: data.primary_color || undefined,
    secondaryColor: data.secondary_color || undefined,
    ownerName: data.owner_name || data.users?.name || undefined,
    ownerEmail: data.owner_email || data.users?.email || undefined,
    cnpj: data.cnpj || data.users?.cnpj || undefined,
    phone: data.phone || data.users?.phone || undefined,
    createdAt: data.created_at || data.owner_created_at || data.users?.created_at || undefined,
    // Address
    postalCode: data.postal_code || undefined,
    addressStreet: data.address_street || undefined,
    addressNumber: data.address_number || undefined,
    neighborhood: data.neighborhood || undefined,
    // Banking & Pix
    pixKeyType: data.pix_key_type || undefined,
    pixKey: data.pix_key || undefined,
    bankCode: data.bank_code || undefined,
    bankAgency: data.bank_agency || undefined,
    bankAccount: data.bank_account || undefined,
    bankAccountDigit: data.bank_account_digit || undefined,
    bankAccountType: data.bank_account_type || undefined,
    bankOwnerName: data.bank_owner_name || undefined,
    bankCpfCnpj: data.bank_cpf_cnpj || undefined,
    // Asaas
    asaasAccountId: data.asaas_account_id || undefined,
    asaasWalletId: data.asaas_wallet_id || undefined,
    asaasStatus: data.asaas_status || (data.asaas_wallet_id ? "active" : "not_created"),
    platformFeePercent: data.platform_fee_percent !== null && data.platform_fee_percent !== undefined ? Number(data.platform_fee_percent) : undefined,
  };
}

export async function getAllCompanies(): Promise<Company[]> {
  const response = await apiCall<{ data: any[] }>("/api/admin/companies");
  return (response.data || []).map(mapCompany);
}

export async function updateCompanyStatus(id: string, status: "approved" | "rejected"): Promise<Company> {
  const response = await apiCall<{ data: any }>(`/api/admin/companies/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return mapCompany(response.data);
}

/**
 * Creates an Asaas subaccount on-demand for a company.
 * Explicitly invoked by Admin.
 */
export async function createCompanySubaccount(id: string): Promise<{
  accountId: string;
  walletId: string;
  status: string;
}> {
  const response = await apiCall<{ data: any }>(`/api/admin/companies/${id}/create-subaccount`, {
    method: "POST",
  });
  return response.data;
}

/**
 * Dispatches a transfer payout from company's Asaas subaccount to their registered bank account / Pix.
 */
export async function transferCompanyFunds(id: string, value: number, description?: string): Promise<any> {
  const response = await apiCall<{ data: any }>(`/api/admin/companies/${id}/transfer-funds`, {
    method: "POST",
    body: JSON.stringify({ value, description }),
  });
  return response.data;
}

export async function getCompanyRentals(companyId: string): Promise<Rental[]> {
  const response = await apiCall<{ data: any[] }>(`/api/admin/companies/${companyId}/rentals`);
  return (response.data || []).map(mapRental);
}

export async function cancelCompanyRental(companyId: string, rentalId: string): Promise<Rental> {
  const response = await apiCall<{ data: any }>(`/api/admin/companies/${companyId}/rentals/${rentalId}/cancel`, {
    method: "POST",
  });
  return mapRental(response.data);
}

/**
 * Manually link an existing Asaas walletId / apiKey to a company.
 */
export async function linkCompanyWallet(
  companyId: string,
  params: { walletId: string; apiKey?: string; accountId?: string }
): Promise<any> {
  const response = await apiCall<{ data: any }>(`/api/admin/companies/${companyId}/link-wallet`, {
    method: "POST",
    body: JSON.stringify(params),
  });
  return response.data;
}
