import { Request, Response, NextFunction } from "express";
import { RentalModel } from "../models/rental.model";
import { CompanyModel } from "../models/company.model";
import { DelivererModel } from "../models/deliverer.model";
import { ToolModel } from "../models/tool.model";
import { supabaseAdmin } from "../config/supabase";
import {
  processPayment,
  selectGateway,
  PaymentUserData,
  PaymentRentalData,
} from "../utils/payment-gateway";

export const RentalController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        tool_id,
        company_id,
        days,
        address,
        shipping_price,
        payment_method,
        coupon_code,
        coupon_discount,
      } = req.body;
      const customerId = (req as any).userId as string;

      // Security: Recalculate total_price server-side
      const tool = await ToolModel.findById(tool_id);
      if (!tool) {
        return res.status(404).json({ error: "Ferramenta não encontrada" });
      }

      // Validate days within tool limits
      const minDays = tool.min_days || 1;
      const maxDays = tool.max_days || 30;
      const safeDays = Number(days) || 1;
      if (safeDays < minDays || safeDays > maxDays) {
        return res.status(400).json({
          error: `Quantidade de dias deve ser entre ${minDays} e ${maxDays}`,
        });
      }

      // Validate company_id matches tool
      if (tool.company_id !== company_id) {
        return res.status(400).json({ error: "Ferramenta não pertence a esta empresa" });
      }

      // Calculate price server-side (never trust client-provided price)
      const toolPrice = Number(tool.price_per_day) || 0;
      const safeShipping = Math.max(0, Number(shipping_price) || 0);

      // SECURITY FIX (CRIT-01): Never trust coupon_discount from client.
      // Coupons must be validated server-side against a coupons table.
      // Until coupon validation is implemented, discount is always 0.
      // TODO: Implement coupon validation: lookup coupon_code in DB,
      //       verify expiry/usage limits, compute discount server-side.
      const safeDiscount = 0;
      if (coupon_code) {
        console.warn(`[Security] Coupon code "${coupon_code}" provided but server-side validation not yet implemented. Discount forced to 0.`);
      }

      const subtotal = toolPrice * safeDays;
      const calculatedTotal = Math.max(0, subtotal + safeShipping - safeDiscount);

      // SECURITY FIX (MED-05): Reject orders with zero total to prevent inventory drain
      if (calculatedTotal <= 0) {
        return res.status(400).json({ error: "O valor total do pedido deve ser maior que zero" });
      }

      // Validate payment method
      const validMethods = ["PIX", "CREDIT_CARD", "DEBIT_CARD"];
      if (!payment_method || !validMethods.includes(payment_method)) {
        return res.status(400).json({
          error: `Método de pagamento inválido. Métodos aceitos: ${validMethods.join(", ")}`,
        });
      }

      // Set expiration to 30 minutes from now
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      // Determine which gateway will be used (for informational logging)
      const gateway = selectGateway(calculatedTotal, payment_method);
      console.log(`[RentalController.create] New rental: R$${calculatedTotal} → gateway: ${gateway}`);

      const rental = await RentalModel.create({
        tool_id,
        company_id,
        customer_id: customerId,
        days: safeDays,
        total_price: calculatedTotal,
        status: "awaiting_payment",
        payment_method,
        shipping_price: safeShipping,
        address,
        coupon_code,
        coupon_discount: safeDiscount,
        expires_at: expiresAt,
      });

      res.status(201).json({ data: rental });
    } catch (err) {
      console.error("[RentalController.create] Error:", err);
      next(err);
    }
  },

  async pay(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { card, installments } = req.body;
      const customerId = (req as any).userId as string;

      const rental = await RentalModel.findById(id);
      if (!rental) {
        return res.status(404).json({ error: "Aluguel não encontrado" });
      }

      if (rental.customer_id !== customerId) {
        return res.status(403).json({ error: "Não autorizado" });
      }

      if (rental.status === "cancelled") {
        return res.status(400).json({ error: "Este pedido foi cancelado e não pode ser pago" });
      }

      if (rental.expires_at && new Date(rental.expires_at) < new Date()) {
        // Cancel the expired rental
        await RentalModel.cancelAndRestore(rental.id);
        return res.status(400).json({ error: "O prazo de 30 minutos para pagamento expirou" });
      }

      // Fetch customer details from database
      const { data: user, error: userError } = await supabaseAdmin
        .from("users")
        .select("name, email, cpf, phone")
        .eq("id", customerId)
        .single();

      if (userError || !user) {
        return res.status(400).json({ error: "Dados cadastrais do cliente não encontrados" });
      }

      const cleanCpf = (user.cpf || "").replace(/\D/g, "");
      if (!cleanCpf || (cleanCpf.length !== 11 && cleanCpf.length !== 14)) {
        console.error(`[Checkout Error] Invalid CPF/CNPJ for user ${customerId}: "${cleanCpf}"`);
        return res.status(400).json({
          error: "O CPF/CNPJ cadastrado no seu perfil é inválido ou ausente. Por favor, atualize seu CPF/CNPJ na aba Perfil antes de finalizar.",
        });
      }

      // Parse phone
      const cleanPhone = (user.phone || "").replace(/\D/g, "");
      let normalizedPhone = cleanPhone;
      if (normalizedPhone.startsWith("55") && (normalizedPhone.length === 12 || normalizedPhone.length === 13)) {
        normalizedPhone = normalizedPhone.substring(2);
      }

      let phoneArea = "11";
      let phoneNumber = "999999999";
      if (normalizedPhone.length >= 10) {
        phoneArea = normalizedPhone.substring(0, 2);
        phoneNumber = normalizedPhone.substring(2);
      } else if (normalizedPhone.length === 8 || normalizedPhone.length === 9) {
        phoneNumber = normalizedPhone;
      }

      // Build unified payment data
      const paymentUser: PaymentUserData = {
        id: customerId,
        name: user.name || "Cliente",
        email: user.email,
        cpf: cleanCpf,
        phoneArea,
        phoneNumber,
      };

      const paymentRental: PaymentRentalData = {
        id: rental.id,
        totalPrice: rental.total_price,
        paymentMethod: rental.payment_method as "PIX" | "CREDIT_CARD" | "DEBIT_CARD",
        toolName: rental.tool?.name || "Aluguel de Ferramenta",
        toolId: rental.tool_id,
        address: rental.address || undefined,
      };

      // Map card data from frontend format to gateway format
      const cardInput = card
        ? {
            number: card.number,
            holder_name: card.holder?.name || user.name,
            exp_month: card.exp_month,
            exp_year: card.exp_year,
            security_code: card.security_code,
            holder: card.holder,
          }
        : undefined;

      // Process payment through the unified gateway router
      const paymentResult = await processPayment(
        paymentRental,
        paymentUser,
        cardInput,
        installments
      );

      // Determine rental status based on payment result
      let newStatus = rental.status;
      if (paymentResult.isPaid) {
        newStatus = "pending"; // Transitions to "Aguardando empresa"
      } else if (paymentResult.status === "DECLINED") {
        return res.status(400).json({
          error: "Pagamento recusado. Verifique os dados do cartão e tente novamente.",
          details: paymentResult.rawResponse,
        });
      }
      // For PIX, status stays awaiting_payment until webhook confirms

      // Prepare normalized payment_data to save in DB
      const paymentDataToSave = {
        ...(typeof paymentResult.rawResponse === "object" && paymentResult.rawResponse !== null ? paymentResult.rawResponse : {}),
        pix_qr_code: paymentResult.pixQrCode || undefined,
        pix_copy_paste: paymentResult.pixCopyPaste || undefined,
        pix_expiration_date: paymentResult.pixExpirationDate || undefined,
        invoice_url: paymentResult.invoiceUrl || undefined,
        authentication_url: paymentResult.authenticationUrl || undefined,
        gateway: paymentResult.gateway,
      };

      // Update rental with payment data
      const updatedRental = await RentalModel.updatePayment(rental.id, {
        payment_id: paymentResult.paymentId,
        payment_status: paymentResult.status,
        payment_data: paymentDataToSave,
        payment_gateway: paymentResult.gateway,
        status: newStatus,
      });

      res.json({
        data: updatedRental,
        payment: {
          gateway: paymentResult.gateway,
          status: paymentResult.status,
          pixQrCode: paymentResult.pixQrCode || undefined,
          pixCopyPaste: paymentResult.pixCopyPaste || undefined,
          invoiceUrl: paymentResult.invoiceUrl || undefined,
          authenticationUrl: paymentResult.authenticationUrl || undefined,
        },
      });
    } catch (err: any) {
      console.error("[RentalController.pay] Error:", err.message || err);
      next(err);
    }
  },

  async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const customerId = (req as any).userId as string;

      const rental = await RentalModel.findById(id);
      if (!rental) {
        return res.status(404).json({ error: "Aluguel não encontrado" });
      }

      if (rental.customer_id !== customerId) {
        return res.status(403).json({ error: "Não autorizado" });
      }

      // Fetch user name for cancellation tracking
      const { data: cancelUser } = await supabaseAdmin
        .from("users")
        .select("name")
        .eq("id", customerId)
        .single();

      const updatedRental = await RentalModel.cancelAndRestore(
        id,
        customerId,
        cancelUser?.name || "Cliente"
      );
      res.json({ data: updatedRental });
    } catch (err) {
      next(err);
    }
  },

  async listByCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = (req as any).userId as string;
      const rentals = await RentalModel.findByCustomer(customerId);
      res.json({ data: rentals });
    } catch (err) {
      next(err);
    }
  },

  async listByCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId as string;
      const { companyId } = req.params;

      // Security: verify user is company owner, admin, or deliverer of this company
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("id", companyId)
        .eq("owner_id", userId)
        .maybeSingle();

      if (!company) {
        // Check if admin
        const { data: adminUser } = await supabaseAdmin
          .from("users")
          .select("is_owner")
          .eq("id", userId)
          .single();

        if (!adminUser?.is_owner) {
          return res.status(403).json({ error: "Não autorizado: acesso restrito ao dono da empresa" });
        }
      }

      const rentals = await RentalModel.findByCompany(companyId);
      res.json({ data: rentals });
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, receiver_name, receiver_cpf, delivery_photos } = req.body;
      const userId = (req as any).userId as string;

      // Input validation: only allow valid status values
      const validStatuses = ["pending", "accepted", "rejected", "delivering", "delivered", "active", "completed", "cancelled", "return_expired"];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status inválido. Valores permitidos: ${validStatuses.join(", ")}` });
      }

      // Security: verify user has permission to update this rental's status
      const rental = await RentalModel.findById(req.params.id);
      if (!rental) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }

      // SECURITY FIX (CRIT-04): Enforce valid status transitions via state machine
      const allowedTransitions: Record<string, string[]> = {
        awaiting_payment: ["pending", "cancelled"],
        pending:          ["accepted", "rejected", "delivering", "delivered", "cancelled"],
        accepted:         ["delivering", "delivered", "active", "completed", "return_expired", "cancelled"],  // Early return requested by customer
        rejected:         [],  // Terminal state — no further transitions allowed
        delivering:       ["delivered", "cancelled"],
        delivered:        ["active", "accepted", "completed", "cancelled"],
        active:           ["completed", "accepted", "return_expired", "cancelled"],
        completed:        [],  // Terminal state
        cancelled:        [],  // Terminal state
        return_expired:   ["completed"],  // Can only be resolved by completing
      };

      const currentStatus = rental.status;
      const allowed = allowedTransitions[currentStatus] || [];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          error: `Transição de status inválida: "${currentStatus}" → "${status}". Transições permitidas: ${allowed.length > 0 ? allowed.join(", ") : "nenhuma (status terminal)"}`,
        });
      }

      // SECURITY FIX (HIGH-03): Require delivery proof for "delivered" status
      if (status === "delivered") {
        if (!receiver_name?.trim() && !receiver_cpf?.trim() && (!delivery_photos || delivery_photos.length === 0)) {
          return res.status(400).json({ error: "Código de entrega / CPF ou comprovação é obrigatório para confirmar a entrega" });
        }
      }

      // Check if user is system owner / admin
      const { data: dbUser } = await supabaseAdmin
        .from("users")
        .select("is_owner, role")
        .eq("id", userId)
        .maybeSingle();

      const isSystemOwner = !!(dbUser?.is_owner || dbUser?.role === "owner" || dbUser?.role === "admin");

      // Check if user is company owner
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("id", rental.company_id)
        .eq("owner_id", userId)
        .maybeSingle();

      // Check if user is a deliverer for this company
      let delivererId: string | undefined;
      const deliverer = await DelivererModel.findByUserId(userId);
      if (deliverer) {
        delivererId = deliverer.id;
      }

      const isCompanyOwner = !!company;
      const isCompanyDeliverer = deliverer && deliverer.company_id === rental.company_id;
      const isCustomerOwner = rental.customer_id === userId;
      const isCustomerEarlyReturn = isCustomerOwner && status === "accepted" && (currentStatus === "delivered" || currentStatus === "active");

      if (!isCompanyOwner && !isCompanyDeliverer && !isSystemOwner && !isCustomerEarlyReturn) {
        return res.status(403).json({ error: "Não autorizado: apenas a empresa, entregador ou cliente (para entrega antecipada) podem atualizar o status" });
      }

      const extras: any = {};
      if (delivererId) extras.deliverer_id = delivererId;
      if (receiver_name) extras.receiver_name = receiver_name;
      if (receiver_cpf) extras.receiver_cpf = receiver_cpf;
      if (delivery_photos && Array.isArray(delivery_photos)) extras.delivery_photos = delivery_photos;

      const updatedRental = await RentalModel.updateStatus(req.params.id, status, extras);
      res.json({ data: updatedRental });
    } catch (err) {
      next(err);
    }
  },

  async rate(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId as string;
      const { rating, comment } = req.body;

      // Input validation
      const numRating = Number(rating);
      if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({ error: "Avaliação deve ser um número inteiro entre 1 e 5" });
      }

      // Security: verify user is the customer who made this rental
      const existingRental = await RentalModel.findById(req.params.id);
      if (!existingRental) {
        return res.status(404).json({ error: "Pedido não encontrado" });
      }
      if (existingRental.customer_id !== userId) {
        return res.status(403).json({ error: "Não autorizado: apenas o cliente pode avaliar" });
      }

      // Sanitize comment (limit length)
      const safeComment = comment ? String(comment).substring(0, 500) : undefined;

      const rental = await RentalModel.setRating(req.params.id, numRating, safeComment);
      await CompanyModel.recalcRating(rental.company_id);
      res.json({ data: rental });
    } catch (err) {
      next(err);
    }
  },

  async listByDeliverer(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId as string;
      // Find the deliverer record for this user
      const deliverer = await DelivererModel.findByUserId(userId);
      if (!deliverer) {
        return res.status(403).json({ error: "Entregador não encontrado" });
      }
      // Return all rentals for the company this deliverer belongs to
      const rentals = await RentalModel.findByCompany(deliverer.company_id);
      
      // Filter: show deliveries that need a courier (not pickup, and status is pending, delivering, delivered, completed, or return_expired)
      const filtered = rentals.filter((r) => {
        const isPickup = !r.address || Number(r.shipping_price) === 0;
        const isRelevantStatus = r.status === "pending" || r.status === "delivering" || r.status === "delivered" || r.status === "completed" || r.status === "return_expired";
        // For return_expired: entregadores só veem pedidos NÃO pickup (pickup é devolvido no balcão pela empresa)
        if (r.status === "return_expired" && isPickup) return false;
        return !isPickup && isRelevantStatus;
      });

      res.json({ data: filtered });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = (req as any).userId as string;

      const rental = await RentalModel.findById(id);
      if (!rental) {
        return res.status(404).json({ error: "Aluguel não encontrado" });
      }

      // Allow: customer who made the order, company owner, or deliverer of the company
      if (rental.customer_id === userId) {
        return res.json({ data: rental });
      }

      // Check if user is a system admin (owner)
      const { data: adminUser } = await supabaseAdmin
        .from("users")
        .select("is_owner")
        .eq("id", userId)
        .single();
      if (adminUser?.is_owner) {
        return res.json({ data: rental });
      }

      // Check if user is the company owner
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("id", rental.company_id)
        .eq("owner_id", userId)
        .maybeSingle();
      if (company) {
        return res.json({ data: rental });
      }

      // Check if user is a deliverer for this company
      const deliverer = await DelivererModel.findByUserId(userId);
      if (deliverer && deliverer.company_id === rental.company_id) {
        return res.json({ data: rental });
      }

      return res.status(403).json({ error: "Não autorizado" });
    } catch (err) {
      next(err);
    }
  },
};
