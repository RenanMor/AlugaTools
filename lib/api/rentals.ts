import { apiCall } from "../_core/api";
import { Rental, RentalStatus } from "../types";

export function mapRental(data: any): Rental {
  return {
    id: data.id,
    toolId: data.tool_id,
    toolName: data.tool?.name || "Ferramenta",
    toolImage: data.tool?.image || "",
    companyId: data.company_id,
    companyName: data.company?.name || "Empresa",
    customerName: data.customer?.name || "Cliente",
    days: Number(data.days) || 1,
    totalPrice: Number(data.total_price) || 0,
    status: data.status,
    createdAt: new Date(data.created_at).getTime(),
    rating: data.rating !== null ? Number(data.rating) : undefined,
  };
}

export async function getMyRentals(): Promise<Rental[]> {
  const response = await apiCall<{ data: any[] }>("/api/rentals/me");
  return (response.data || []).map(mapRental);
}

export async function getRentalsByCompany(companyId: string): Promise<Rental[]> {
  const response = await apiCall<{ data: any[] }>(`/api/rentals/company/${companyId}`);
  return (response.data || []).map(mapRental);
}

export async function createRental(rental: {
  toolId: string;
  companyId: string;
  days: number;
  totalPrice: number;
}): Promise<Rental> {
  const response = await apiCall<{ data: any }>("/api/rentals", {
    method: "POST",
    body: JSON.stringify({
      tool_id: rental.toolId,
      company_id: rental.companyId,
      days: rental.days,
      total_price: rental.totalPrice,
    }),
  });
  return mapRental(response.data);
}

export async function updateRentalStatus(id: string, status: RentalStatus): Promise<Rental> {
  const response = await apiCall<{ data: any }>(`/api/rentals/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return mapRental(response.data);
}

export async function rateRental(id: string, rating: number): Promise<Rental> {
  const response = await apiCall<{ data: any }>(`/api/rentals/${id}/rating`, {
    method: "PATCH",
    body: JSON.stringify({ rating }),
  });
  return mapRental(response.data);
}
