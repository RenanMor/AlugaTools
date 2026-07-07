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
    ratingComment: data.rating_comment || undefined,
    paymentMethod: data.payment_method || undefined,
    paymentId: data.payment_id || undefined,
    paymentStatus: data.payment_status || undefined,
    paymentData: data.payment_data || undefined,
    expiresAt: data.expires_at || undefined,
    shippingPrice: data.shipping_price !== undefined ? Number(data.shipping_price) : undefined,
    address: data.address || undefined,
    couponCode: data.coupon_code || undefined,
    couponDiscount: data.coupon_discount !== undefined ? Number(data.coupon_discount) : undefined,
    delivererId: data.deliverer_id || undefined,
    deliveredAt: data.delivered_at ? new Date(data.delivered_at).getTime() : undefined,
  };
}

export async function getMyRentals(): Promise<Rental[]> {
  const response = await apiCall<{ data: any[] }>("/api/rentals/me");
  return (response.data || []).map(mapRental);
}

export async function getRentalById(id: string): Promise<Rental> {
  const response = await apiCall<{ data: any }>(`/api/rentals/${id}`);
  return mapRental(response.data);
}

export async function getRentalsByCompany(companyId: string): Promise<Rental[]> {
  const response = await apiCall<{ data: any[] }>(`/api/rentals/company/${companyId}`);
  return (response.data || []).map(mapRental);
}

export async function getDelivererRentals(): Promise<Rental[]> {
  const response = await apiCall<{ data: any[] }>("/api/rentals/deliverer");
  return (response.data || []).map(mapRental);
}

export async function createRental(rental: {
  toolId: string;
  companyId: string;
  days: number;
  totalPrice: number;
  paymentMethod?: string;
  shippingPrice?: number;
  address?: any;
  couponCode?: string;
  couponDiscount?: number;
}): Promise<Rental> {
  const response = await apiCall<{ data: any }>("/api/rentals", {
    method: "POST",
    body: JSON.stringify({
      tool_id: rental.toolId,
      company_id: rental.companyId,
      days: rental.days,
      total_price: rental.totalPrice,
      payment_method: rental.paymentMethod,
      shipping_price: rental.shippingPrice,
      address: rental.address,
      coupon_code: rental.couponCode,
      coupon_discount: rental.couponDiscount,
    }),
  });
  return mapRental(response.data);
}

export async function payRental(
  id: string,
  paymentData: { card?: any; installments?: number }
): Promise<{ data: Rental; payment: any }> {
  const response = await apiCall<{ data: any; payment: any }>(`/api/rentals/${id}/pay`, {
    method: "POST",
    body: JSON.stringify(paymentData),
  });
  return {
    data: mapRental(response.data),
    payment: response.payment,
  };
}

export async function cancelRental(id: string): Promise<Rental> {
  const response = await apiCall<{ data: any }>(`/api/rentals/${id}/cancel`, {
    method: "POST",
  });
  return mapRental(response.data);
}

export async function lookupCep(cep: string): Promise<any> {
  const response = await apiCall<{ data: any }>(`/api/cep/${cep}`);
  return response.data;
}

export async function updateRentalStatus(id: string, status: RentalStatus): Promise<Rental> {
  const response = await apiCall<{ data: any }>(`/api/rentals/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  return mapRental(response.data);
}

export async function rateRental(id: string, rating: number, comment?: string): Promise<Rental> {
  const response = await apiCall<{ data: any }>(`/api/rentals/${id}/rating`, {
    method: "PATCH",
    body: JSON.stringify({ rating, comment }),
  });
  return mapRental(response.data);
}
