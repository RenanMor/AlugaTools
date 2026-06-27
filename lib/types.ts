export type ProfileType = "customer" | "company";

export type RentalStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "active"
  | "completed";

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Tool {
  id: string;
  companyId: string;
  name: string;
  description: string;
  categoryId: string;
  image: string;
  pricePerDay: number;
  available: boolean;
}

export interface Company {
  id: string;
  name: string;
  logo: string;
  description: string;
  categoryId: string;
  rating: number;
  ratingCount: number;
  location: string;
}

export interface CartItem {
  tool: Tool;
  companyName: string;
  days: number;
}

export interface Rental {
  id: string;
  toolId: string;
  toolName: string;
  toolImage: string;
  companyId: string;
  companyName: string;
  customerName: string;
  days: number;
  totalPrice: number;
  status: RentalStatus;
  createdAt: number;
  rating?: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  profile: ProfileType;
  companyId?: string;
}
