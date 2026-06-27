import { apiCall } from "../_core/api";
import { Company } from "../types";

export function mapCompany(data: any): Company {
  return {
    id: data.id,
    name: data.name,
    logo: data.logo || "",
    description: data.description || "",
    categoryId: data.category_id,
    rating: Number(data.rating) || 0,
    ratingCount: Number(data.rating_count) || 0,
    location: data.location || "",
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
