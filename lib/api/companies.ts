import { apiCall } from "../_core/api";
import { Company } from "../types";

export function mapCompany(data: any): Company {
  const cleanName = (data.name || "")
    .replace(/^Locações\s+/i, "")
    .replace(/\s+Locações$/i, "");

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

  const response = await apiCall<{ data: any }>(`/api/companies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return mapCompany(response.data);
}
