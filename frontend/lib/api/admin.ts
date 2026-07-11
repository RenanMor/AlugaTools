import { apiCall } from "../_core/api";
import { Company, Rental } from "../types";
import { mapRental } from "./rentals";

// Map raw company object to Company interface if needed
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
