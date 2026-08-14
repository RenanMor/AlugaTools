import { Router, Request, Response } from "express";
import { RentalModel } from "../models/rental.model";
import { getPagarmeOrderStatus } from "../utils/pagarme";
import { getAsaasPaymentStatus } from "../utils/asaas";

const router = Router();

// ============================================================
// Pagar.me Webhook
// ============================================================

/**
 * Pagar.me sends webhook notifications when payment status changes.
 * We always verify the order status directly with Pagar.me API
 * before updating our database (never trust webhook payload alone).
 */
router.post("/pagarme", async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // Pagar.me V5 webhook sends order data with 'code' field
    // The code is our reference_id format: "rental_<uuid>"
    const orderCode = payload?.data?.code || payload?.code || "";
    const orderId = payload?.data?.id || payload?.id || "";

    console.log(`[Webhook Pagar.me] Received event. Order code: ${orderCode}, Order ID: ${orderId}`);

    if (!orderCode || !orderCode.startsWith("rental_")) {
      // Try to find by order ID in payment_id field
      if (orderId) {
        const rental = await findRentalByPaymentId(orderId);
        if (rental) {
          await verifyAndUpdatePagarme(rental);
        }
      }
      return res.status(200).send("OK");
    }

    const rentalId = orderCode.replace("rental_", "");
    const rental = await RentalModel.findById(rentalId);

    if (!rental || !rental.payment_id) {
      console.warn(`[Webhook Pagar.me] Rental ${rentalId} not found or missing payment_id. Ignoring.`);
      return res.status(200).send("OK");
    }

    await verifyAndUpdatePagarme(rental);

    res.status(200).send("OK");
  } catch (error) {
    console.error("[Webhook Pagar.me] Error:", error);
    // Always return 200 so Pagar.me doesn't retry unnecessarily
    res.status(200).send("Error processed");
  }
});

async function verifyAndUpdatePagarme(rental: any) {
  // Security: Verify payment status directly with Pagar.me API
  const { isPaid } = await getPagarmeOrderStatus(rental.payment_id);

  if (isPaid && rental.payment_status !== "PAID") {
    await RentalModel.updatePayment(rental.id, {
      payment_status: "PAID",
      status: "pending", // "Aguardando empresa"
    });
    console.log(`[Webhook Pagar.me] Rental ${rental.id} payment verified. Status updated to pending.`);
  }
}

// ============================================================
// Asaas Webhook
// ============================================================

/**
 * Asaas sends webhook notifications for payment events.
 * Events of interest: PAYMENT_CONFIRMED, PAYMENT_RECEIVED
 * We always verify the payment status directly with Asaas API.
 *
 * Asaas webhook payload format:
 * {
 *   "event": "PAYMENT_CONFIRMED",
 *   "payment": {
 *     "id": "pay_...",
 *     "externalReference": "rental_<uuid>",
 *     "status": "CONFIRMED",
 *     ...
 *   }
 * }
 */
router.post("/asaas", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const event = payload?.event || "";
    const paymentData = payload?.payment || {};
    const externalReference = paymentData?.externalReference || "";
    const asaasPaymentId = paymentData?.id || "";

    console.log(`[Webhook Asaas] Received event: ${event}, Payment ID: ${asaasPaymentId}, Ref: ${externalReference}`);

    // Only process payment confirmation events
    const confirmationEvents = [
      "PAYMENT_CONFIRMED",
      "PAYMENT_RECEIVED",
      "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED", // Need to handle declined
    ];

    if (!confirmationEvents.includes(event)) {
      return res.status(200).send("OK");
    }

    if (!externalReference || !externalReference.startsWith("rental_")) {
      // Try to find by payment_id
      if (asaasPaymentId) {
        const rental = await findRentalByPaymentId(asaasPaymentId);
        if (rental) {
          await verifyAndUpdateAsaas(rental);
        }
      }
      return res.status(200).send("OK");
    }

    const rentalId = externalReference.replace("rental_", "");
    const rental = await RentalModel.findById(rentalId);

    if (!rental || !rental.payment_id) {
      console.warn(`[Webhook Asaas] Rental ${rentalId} not found or missing payment_id. Ignoring.`);
      return res.status(200).send("OK");
    }

    // Handle declined payments
    if (event === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED") {
      await RentalModel.updatePayment(rental.id, {
        payment_status: "DECLINED",
      });
      console.log(`[Webhook Asaas] Rental ${rental.id} payment declined.`);
      return res.status(200).send("OK");
    }

    await verifyAndUpdateAsaas(rental);

    res.status(200).send("OK");
  } catch (error) {
    console.error("[Webhook Asaas] Error:", error);
    // Always return 200 so Asaas doesn't retry unnecessarily
    res.status(200).send("Error processed");
  }
});

async function verifyAndUpdateAsaas(rental: any) {
  // Security: Verify payment status directly with Asaas API
  const { isPaid } = await getAsaasPaymentStatus(rental.payment_id);

  if (isPaid && rental.payment_status !== "PAID") {
    await RentalModel.updatePayment(rental.id, {
      payment_status: "PAID",
      status: "pending", // "Aguardando empresa"
    });
    console.log(`[Webhook Asaas] Rental ${rental.id} payment verified. Status updated to pending.`);
  }
}

// ============================================================
// Helpers
// ============================================================

/**
 * Find a rental by its payment_id (gateway order/payment ID).
 */
async function findRentalByPaymentId(paymentId: string) {
  try {
    const { supabaseAdmin } = require("../config/supabase");
    const { data } = await supabaseAdmin
      .from("rentals")
      .select("*")
      .eq("payment_id", paymentId)
      .maybeSingle();
    if (data) {
      return data;
    }
  } catch (err) {
    console.warn(`[Webhook] Could not find rental by payment_id ${paymentId}:`, err);
  }
  return null;
}

export default router;
