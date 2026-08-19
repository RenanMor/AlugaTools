import { Router, Request, Response } from "express";
import { RentalModel } from "../models/rental.model";
import { getMercadoPagoPaymentStatus } from "../utils/mercadopago";
import { getPagarmeOrderStatus } from "../utils/pagarme";
import { getAsaasPaymentStatus } from "../utils/asaas";

const router = Router();

// ============================================================
// 1. Mercado Pago Webhook (PRIMARY ACTIVE)
// ============================================================

/**
 * Mercado Pago sends notifications for payment status events.
 * Handles both IPN format (?topic=payment&id=...) and Webhooks v2 format (body: { type: "payment", data: { id: "..." } }).
 * Always validates directly with Mercado Pago API before updating database.
 */
router.post("/mercadopago", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const query = req.query || {};

    console.log(
      "[Webhook MercadoPago] Received notification:",
      JSON.stringify({ body, query }, null, 2)
    );

    // Extract payment ID from various possible notification formats
    const paymentId =
      body.data?.id ||
      body.id ||
      query.id ||
      query["data.id"] ||
      (query.topic === "payment" ? query.id : null);

    const type = body.type || body.action || query.topic || "";

    if (!paymentId) {
      console.log("[Webhook MercadoPago] No paymentId found in payload/query. Acknowledged.");
      return res.status(200).send("OK");
    }

    // Only process payment notifications
    if (type && !String(type).includes("payment")) {
      console.log(`[Webhook MercadoPago] Notification type "${type}" is not payment. Acknowledged.`);
      return res.status(200).send("OK");
    }

    // Step 1: Query Mercado Pago API directly to verify the real payment data
    const { isPaid, status, paymentData } = await getMercadoPagoPaymentStatus(String(paymentId));

    if (!paymentData) {
      console.warn(`[Webhook MercadoPago] Payment ${paymentId} could not be retrieved from Mercado Pago API.`);
      return res.status(200).send("OK");
    }

    // Step 2: Match rental by external_reference or payment_id
    const externalReference = paymentData.external_reference || "";
    let rental = null;

    if (externalReference && externalReference.startsWith("rental_")) {
      const rentalId = externalReference.replace("rental_", "");
      rental = await RentalModel.findById(rentalId);
    }

    if (!rental) {
      rental = await findRentalByPaymentId(String(paymentId));
    }

    if (!rental) {
      console.warn(
        `[Webhook MercadoPago] Rental not found for paymentId ${paymentId} (external_ref: ${externalReference}).`
      );
      return res.status(200).send("OK");
    }

    // Step 3: Update rental status if approved
    if (isPaid && rental.payment_status !== "PAID") {
      await RentalModel.updatePayment(rental.id, {
        payment_id: String(paymentId),
        payment_status: "PAID",
        status: "pending", // Transitions to "Aguardando empresa"
      });
      console.log(`[Webhook MercadoPago] Rental ${rental.id} payment approved! Status updated to pending.`);
    } else if (status === "rejected" || status === "cancelled") {
      await RentalModel.updatePayment(rental.id, {
        payment_id: String(paymentId),
        payment_status: "DECLINED",
      });
      console.log(`[Webhook MercadoPago] Rental ${rental.id} payment rejected/declined.`);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("[Webhook MercadoPago] Error:", error);
    // Always return 200 so Mercado Pago does not flood retries on unhandled errors
    res.status(200).send("OK");
  }
});

// Also support GET for Mercado Pago webhook health check verification
router.get("/mercadopago", (_req: Request, res: Response) => {
  res.status(200).send("Mercado Pago Webhook Endpoint Active");
});

// ============================================================
// 2. Pagar.me Webhook (INACTIVE / DISABLED)
// ============================================================

router.post("/pagarme", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const orderCode = payload?.data?.code || payload?.code || "";
    const orderId = payload?.data?.id || payload?.id || "";

    console.log(`[Webhook Pagar.me] Received event (Inactive gateway). Order code: ${orderCode}, ID: ${orderId}`);

    if (orderCode?.startsWith("rental_")) {
      const rentalId = orderCode.replace("rental_", "");
      const rental = await RentalModel.findById(rentalId);
      if (rental?.payment_id) {
        const { isPaid } = await getPagarmeOrderStatus(rental.payment_id);
        if (isPaid && rental.payment_status !== "PAID") {
          await RentalModel.updatePayment(rental.id, {
            payment_status: "PAID",
            status: "pending",
          });
        }
      }
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("[Webhook Pagar.me] Error:", error);
    res.status(200).send("OK");
  }
});

// ============================================================
// 3. Asaas Webhook (INACTIVE / DISABLED)
// ============================================================

router.post("/asaas", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const event = payload?.event || "";
    const paymentData = payload?.payment || {};
    const externalReference = paymentData?.externalReference || "";

    console.log(`[Webhook Asaas] Received event (Inactive gateway): ${event}, Ref: ${externalReference}`);

    if (["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(event) && externalReference?.startsWith("rental_")) {
      const rentalId = externalReference.replace("rental_", "");
      const rental = await RentalModel.findById(rentalId);
      if (rental?.payment_id) {
        const { isPaid } = await getAsaasPaymentStatus(rental.payment_id);
        if (isPaid && rental.payment_status !== "PAID") {
          await RentalModel.updatePayment(rental.id, {
            payment_status: "PAID",
            status: "pending",
          });
        }
      }
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("[Webhook Asaas] Error:", error);
    res.status(200).send("OK");
  }
});

// ============================================================
// Helpers
// ============================================================

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
