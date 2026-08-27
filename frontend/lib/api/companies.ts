import { apiCall } from "../_core/api";
import { Company } from "../types";

export function mapCompany(data: any): Company {
  const cleanName = (data.name || "")
    .replace(/^ \s+/i, "")
    .replace(/\s+ $/i, "");

  return {
    id: data.id,
    name: cleanName,
    logo: data.logo || "",
    description: data.description || "",
    categoryId: data.category_id,
    rating: Number(data.rating) || 0,
    ratingCount: Number(data.rating_count) || 0,
    location: data.location || "",
    state: data.state || undefined,
    city: data.city || undefined,
    isOpen: data.is_open !== undefined ? !!data.is_open : true,
    primaryColor: data.primary_color || undefined,
    secondaryColor: data.secondary_color || undefined,
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
  };
}

export async function getFeaturedCompanies(): Promise<Company[]> {
  const response = await apiCall<{ data: any[] }>("/api/companies/featured");
  return (response.data || []).map(mapCompany);
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const response = await apiCall<{ data: any }>(`/api/companies/${id}`);
  return response.data ? mapCompany(response.data) : null;
}

export async function getCompaniesByCategory(categoryId: string): Promise<Company[]> {
  const response = await apiCall<{ data: any[] }>(`/api/companies/category/${categoryId}`);
  return (response.data || []).map(mapCompany);
}

export async function validatePixKey(
  type: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP",
  key: string
): Promise<{
  valid: boolean;
  name?: string;
  cpfCnpj?: string;
  ispb?: string;
  errorMessage?: string;
}> {
  const response = await apiCall<{ data: any }>("/api/companies/validate-pix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, key }),
  });
  return response.data;
}

export async function updateCompany(
  id: string,
  company: Partial<Company>
): Promise<Company> {
  const payload: any = {};
  if (company.name !== undefined) payload.name = company.name;
  if (company.logo !== undefined) payload.logo = company.logo;
  if (company.description !== undefined) payload.description = company.description;
  if (company.categoryId !== undefined) payload.category_id = company.categoryId;
  if (company.location !== undefined) payload.location = company.location;
  if (company.state !== undefined) payload.state = company.state;
  if (company.city !== undefined) payload.city = company.city;
  if (company.isOpen !== undefined) payload.is_open = company.isOpen;

  // Address
  if (company.postalCode !== undefined) payload.postal_code = company.postalCode;
  if (company.addressStreet !== undefined) payload.address_street = company.addressStreet;
  if (company.addressNumber !== undefined) payload.address_number = company.addressNumber;
  if (company.neighborhood !== undefined) payload.neighborhood = company.neighborhood;

  // Banking
  if (company.pixKeyType !== undefined) payload.pix_key_type = company.pixKeyType;
  if (company.pixKey !== undefined) payload.pix_key = company.pixKey;
  if (company.bankCode !== undefined) payload.bank_code = company.bankCode;
  if (company.bankAgency !== undefined) payload.bank_agency = company.bankAgency;
  if (company.bankAccount !== undefined) payload.bank_account = company.bankAccount;
  if (company.bankAccountDigit !== undefined) payload.bank_account_digit = company.bankAccountDigit;
  if (company.bankAccountType !== undefined) payload.bank_account_type = company.bankAccountType;
  if (company.bankOwnerName !== undefined) payload.bank_owner_name = company.bankOwnerName;
  if (company.bankCpfCnpj !== undefined) payload.bank_cpf_cnpj = company.bankCpfCnpj;

  const response = await apiCall<{ data: any }>(`/api/companies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return mapCompany(response.data);
}
