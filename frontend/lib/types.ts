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
  | "cancelled"
  | "return_expired";

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
  images?: string[];
  pricePerDay: number;
  available: boolean;
  quantity: number;
  minDays: number;
  maxDays: number;
  rating?: number;
  ratingCount?: number;
}

export interface ToolReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: number;
  customerName: string;
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
  state?: string;
  city?: string;
  isOpen?: boolean;
  status?: "pending" | "approved" | "rejected";
  primaryColor?: string;
  secondaryColor?: string;
  ownerName?: string;
  ownerEmail?: string;
  cnpj?: string;
  phone?: string;
  createdAt?: string;
  // Address for onboarding
  postalCode?: string;
  addressStreet?: string;
  addressNumber?: string;
  neighborhood?: string;
  // Pix / Banking details for payouts
  pixKeyType?: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
  pixKey?: string;
  bankCode?: string;
  bankAgency?: string;
  bankAccount?: string;
  bankAccountDigit?: string;
  bankAccountType?: "CONTA_CORRENTE" | "CONTA_POUPANCA";
  bankOwnerName?: string;
  bankCpfCnpj?: string;
  // Asaas Subaccount details
  asaasAccountId?: string;
  asaasWalletId?: string;
  asaasStatus?: "not_created" | "pending" | "active" | "error";
  platformFeePercent?: number;
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
  customerCpf?: string;
  days: number;
  totalPrice: number;
  status: RentalStatus;
  createdAt: number;
  rating?: number;
  ratingComment?: string;
  paymentMethod?: string;
  paymentId?: string;
  paymentStatus?: string;
  paymentData?: any;
  paymentGateway?: "mercadopago" | "pagarme" | "asaas";
  expiresAt?: string;
  shippingPrice?: number;
  address?: any;
  couponCode?: string;
  couponDiscount?: number;
  delivererId?: string;
  deliveredAt?: number;
  customerNote?: string;
  receiverName?: string;
  receiverCpf?: string;
  deliveryPhotos?: string[];
  delivererName?: string;
  cancelledBy?: string;
  cancelledByName?: string;
}

export interface UserAddress {
  id: string;
  title?: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  isDefault?: boolean;
  createdAt?: number;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  profile: ProfileType;
  companyId?: string;
  delivererCompanyId?: string;
  role?: string;
  avatarUrl?: string;
  isOwner?: boolean;
  companyStatus?: string;
  primaryColor?: string;
  secondaryColor?: string;
}
