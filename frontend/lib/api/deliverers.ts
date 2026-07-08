import { apiCall } from "../_core/api";
import { Deliverer } from "../types";

export function mapDeliverer(data: any): Deliverer {
  return {
    id: data.id,
    companyId: data.company_id,
    userId: data.user_id || undefined,
    name: data.name,
    email: data.email,
    phone: data.phone,
    active: !!data.active,
    createdAt: data.created_at ? new Date(data.created_at).getTime() : undefined,
  };
}

export async function getDeliverersByCompany(companyId: string): Promise<Deliverer[]> {
  const response = await apiCall<{ data: any[] }>(`/api/deliverers/company/${companyId}`);
  return (response.data || []).map(mapDeliverer);
}

export async function createDeliverer(deliverer: {
  companyId: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
}): Promise<Deliverer> {
  const response = await apiCall<{ data: any }>("/api/deliverers", {
    method: "POST",
    body: JSON.stringify({
      company_id: deliverer.companyId,
      name: deliverer.name,
      email: deliverer.email,
      phone: deliverer.phone,
      password: deliverer.password || "123456",
    }),
  });
  return mapDeliverer(response.data);
}

export async function updateDeliverer(
  id: string,
  deliverer: Partial<Pick<Deliverer, "name" | "email" | "phone" | "active">>
): Promise<Deliverer> {
  const response = await apiCall<{ data: any }>(`/api/deliverers/${id}`, {
    method: "PUT",
    body: JSON.stringify(deliverer),
  });
  return mapDeliverer(response.data);
}

export async function deleteDeliverer(id: string): Promise<void> {
  await apiCall(`/api/deliverers/${id}`, {
    method: "DELETE",
  });
}
