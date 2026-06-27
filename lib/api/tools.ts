import { apiCall } from "../_core/api";
import { Tool } from "../types";

export function mapTool(data: any): Tool {
  return {
    id: data.id,
    companyId: data.company_id,
    name: data.name,
    description: data.description || "",
    categoryId: data.category_id,
    image: data.image || data.image_url || "",
    pricePerDay: Number(data.price_per_day) || 0,
    available: !!data.available,
    quantity: Number(data.quantity) || 1,
  };
}

export function mapToolToDb(tool: Partial<Tool>): any {
  const data: any = {};
  if (tool.companyId !== undefined) data.company_id = tool.companyId;
  if (tool.name !== undefined) data.name = tool.name;
  if (tool.description !== undefined) data.description = tool.description;
  if (tool.categoryId !== undefined) data.category_id = tool.categoryId;
  if (tool.image !== undefined) data.image = tool.image;
  if (tool.pricePerDay !== undefined) data.price_per_day = tool.pricePerDay;
  if (tool.available !== undefined) data.available = tool.available;
  if (tool.quantity !== undefined) data.quantity = tool.quantity;
  return data;
}

export async function getAllTools(): Promise<Tool[]> {
  const response = await apiCall<{ data: any[] }>("/api/tools");
  return (response.data || []).map(mapTool);
}

export async function getToolsByCompany(companyId: string): Promise<Tool[]> {
  const response = await apiCall<{ data: any[] }>(`/api/tools/company/${companyId}`);
  return (response.data || []).map(mapTool);
}

export async function createTool(tool: Omit<Tool, "id">): Promise<Tool> {
  const response = await apiCall<{ data: any }>("/api/tools", {
    method: "POST",
    body: JSON.stringify(mapToolToDb(tool)),
  });
  return mapTool(response.data);
}

export async function updateTool(id: string, tool: Partial<Tool>): Promise<Tool> {
  const response = await apiCall<{ data: any }>(`/api/tools/${id}`, {
    method: "PUT",
    body: JSON.stringify(mapToolToDb(tool)),
  });
  return mapTool(response.data);
}

export async function deleteTool(id: string): Promise<void> {
  await apiCall<void>(`/api/tools/${id}`, {
    method: "DELETE",
  });
}
