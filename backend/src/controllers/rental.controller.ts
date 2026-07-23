import { Request, Response, NextFunction } from "express";
import { RentalModel } from "../models/rental.model";
import { CompanyModel } from "../models/company.model";
import { DelivererModel } from "../models/deliverer.model";
import { supabaseAdmin } from "../config/supabase";
import {
  createPagBankOrder,
  payWithPix,
  payWithCreditCard,
  payWithDebitCard,
  payWithBoleto,
} from "../utils/pagbank";

export const RentalController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        tool_id,
        company_id,
        days,
        total_price,
        address,
        shipping_price,
        payment_method,
        coupon_code,
        coupon_discount,
      } = req.body;
      const customerId = (req as any).userId as string;

      // Set expiration to 30 minutes from now
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      const rental = await RentalModel.create({
        tool_id,
        company_id,
        customer_id: customerId,
        days,
        total_price,
        status: "awaiting_payment",
        payment_method,
        shipping_price: Number(shipping_price) || 0,
        address,
        coupon_code,
        coupon_discount: Number(coupon_discount) || 0,
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

      // Fetch customer details from database for PagBank
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

      // Format user name to ensure it has both first and last name for PagBank
      const customerName = (user.name || "").trim();
      const formattedName = customerName.split(/\s+/).length >= 2 
        ? customerName 
        : `${customerName} Silva`;

      // Map checkout address to PagBank format
      const addr = rental.address || {};
      const pagBankAddress = {
        street: addr.street || "Rua Ficticia",
        number: addr.number || "123",
        complement: addr.complement || undefined,
        locality: addr.neighborhood || "Bairro",
        city: addr.city || "Cidade",
        region: addr.state || "SP",
        region_code: (addr.state || "SP").substring(0, 2).toUpperCase(),
        country: "BRA",
        postal_code: (addr.cep || "").replace(/\D/g, "") || "01001000",
      };

      // Create PagBank order first
      const order = await createPagBankOrder({
        referenceId: `rental_${rental.id}`,
        customer: {
          name: formattedName,
          email: user.email,
          tax_id: cleanCpf,
          phones: [
            {
              country: "55",
              area: phoneArea,
              number: phoneNumber,
              type: "MOBILE",
            },
          ],
        },
        items: [
          {
            reference_id: rental.tool_id,
            name: rental.tool?.name || "Aluguel de Ferramenta",
            quantity: 1,
            unit_amount: Math.round(rental.total_price * 100),
          },
        ],
        shippingAddress: rental.payment_method === "BOLETO" || rental.payment_method === "CREDIT_CARD" || rental.payment_method === "DEBIT_CARD"
          ? pagBankAddress
          : undefined,
        notificationUrls: process.env.PUBLIC_API_URL 
          ? [`${process.env.PUBLIC_API_URL}/api/webhooks/pagbank`] 
          : undefined,
      });

      let paymentResult: any;
      let newStatus = rental.status;
      let paymentStatus = "PENDING";

      const amountCents = Math.round(rental.total_price * 100);

      // Charge payment depending on method
      if (rental.payment_method === "PIX") {
        paymentResult = await payWithPix(order.id, amountCents);
        const charge = paymentResult.charges?.[0];
        paymentStatus = charge?.status || "PENDING";
      } else if (rental.payment_method === "CREDIT_CARD") {
        if (!card) {
          return res.status(400).json({ error: "Dados do cartão de crédito ausentes" });
        }
        paymentResult = await payWithCreditCard(
          order.id,
          amountCents,
          card,
          installments || 1,
          true,
          card.holder?.name || user.name,
          cleanCpf
        );
        const charge = paymentResult.charges?.[0];
        paymentStatus = charge?.status || "PENDING";

        if (paymentStatus === "PAID" || paymentStatus === "AUTHORIZED") {
          newStatus = "pending"; // Transitions to "Aguardando empresa"
        } else {
          return res.status(400).json({
            error: `Pagamento recusado: ${charge?.payment_response?.message || "Erro desconhecido"}`,
            details: charge,
          });
        }
      } else if (rental.payment_method === "DEBIT_CARD") {
        if (!card) {
          return res.status(400).json({ error: "Dados do cartão de débito ausentes" });
        }
        paymentResult = await payWithDebitCard(
          order.id,
          amountCents,
          card,
          card.holder?.name || user.name,
          cleanCpf
        );
        const charge = paymentResult.charges?.[0];
        paymentStatus = charge?.status || "PENDING";

        if (paymentStatus === "PAID" || paymentStatus === "AUTHORIZED") {
          newStatus = "pending"; // Transitions to "Aguardando empresa"
        } else {
          return res.status(400).json({
            error: `Pagamento recusado: ${charge?.payment_response?.message || "Erro desconhecido"}`,
            details: charge,
          });
        }
      } else if (rental.payment_method === "BOLETO") {
        // Set boleto due date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dueDateStr = tomorrow.toISOString().substring(0, 10);

        paymentResult = await payWithBoleto(
          order.id,
          amountCents,
          dueDateStr,
          user.name,
          cleanCpf,
          user.email,
          pagBankAddress
        );
        const charge = paymentResult.charges?.[0];
        paymentStatus = charge?.status || "PENDING";
      } else {
        return res.status(400).json({ error: "Método de pagamento inválido ou não suportado" });
      }

      // Update rental status and payment data
      const updatedRental = await RentalModel.updatePayment(rental.id, {
        payment_id: order.id,
        payment_status: paymentStatus,
        payment_data: paymentResult,
        status: newStatus,
      });

      res.json({ data: updatedRental, payment: paymentResult });
    } catch (err: any) {
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
      const rentals = await RentalModel.findByCompany(req.params.companyId);
      res.json({ data: rentals });
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, receiver_name, receiver_cpf } = req.body;
      const userId = (req as any).userId as string;
      
      let delivererId: string | undefined = req.body.deliverer_id;
      
      // If the user updating is a deliverer, auto-assign their deliverer ID
      if (userId) {
        const deliverer = await DelivererModel.findByUserId(userId);
        if (deliverer) {
          delivererId = deliverer.id;
        }
      }

      const extras: any = {};
      if (delivererId) extras.deliverer_id = delivererId;
      if (receiver_name) extras.receiver_name = receiver_name;
      if (receiver_cpf) extras.receiver_cpf = receiver_cpf;

      const rental = await RentalModel.updateStatus(req.params.id, status, extras);
      res.json({ data: rental });
    } catch (err) {
      next(err);
    }
  },

  async rate(req: Request, res: Response, next: NextFunction) {
    try {
      const { rating, comment } = req.body;
      const rental = await RentalModel.setRating(req.params.id, rating, comment);
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
