export type ProfileType = "customer" | "company" | "deliverer";

export type RentalStatus =
  | "awaiting_payment"
  | "pending"
  | "accepted"
  | "rejected"
  | "delivering"
  | "delivered"
  | "active"
  | "completed"
  | "cancelled";

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
  quantity: number;
  minDays: number;
  maxDays: number;
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
  id: string;
  tool: Tool;
  companyName: string;
  days: number;
  quantity: number;
}

export interface Deliverer {
  id: string;
  companyId: string;
  userId?: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  createdAt?: number;
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
  paymentMethod?: string;
  paymentId?: string;
  paymentStatus?: string;
  paymentData?: any;
  expiresAt?: string;
  shippingPrice?: number;
  address?: any;
  couponCode?: string;
  couponDiscount?: number;
  delivererId?: string;
  deliveredAt?: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  profile: ProfileType;
  companyId?: string;
  delivererCompanyId?: string;
  role?: string;
}
