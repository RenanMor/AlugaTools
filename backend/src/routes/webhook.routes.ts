import { Router, Request, Response } from "express";
import axios from "axios";
import { RentalModel } from "../models/rental.model";
import { env } from "../config/env";

const router = Router();

/**
 * Verify order status directly with PagBank API.
 * Never trust webhook payload alone — always confirm with the source.
 */
async function verifyPagBankOrder(orderId: string): Promise<{ isPaid: boolean; orderData: any }> {
  try {
    const response = await axios.get(`${env.pagBankBaseUrl}/orders/${orderId}`, {
      headers: {
        Authorization: `Bearer ${env.pagBankToken}`,
        "Content-Type": "application/json",
        "x-api-version": "4.0",
      },
    });

    const order = response.data;
    const charges = order.charges || [];
    const isPaid = charges.some((charge: any) =>
      charge.status === "PAID" || charge.status === "AUTHORIZED"
    );

    return { isPaid, orderData: order };
  } catch (error: any) {
    console.error("[Webhook] PagBank order verification failed:", error.response?.status || error.message);
    return { isPaid: false, orderData: null };
  }
}

router.post("/pagbank", async (req: Request, res: Response) => {
  try {
    const payload = req.body;

    // PagBank webhook payload typically has 'reference_id' and 'charges' array
    const referenceId = payload.reference_id;

    if (!referenceId || !referenceId.startsWith("rental_")) {
      return res.status(400).json({ error: "Invalid reference_id" });
    }

    const rentalId = referenceId.replace("rental_", "");

    // Verify: fetch the rental to get the PagBank order ID
    const rental = await RentalModel.findById(rentalId);
    if (!rental || !rental.payment_id) {
      console.warn(`[Webhook] Rental ${rentalId} not found or missing payment_id. Ignoring.`);
      return res.status(200).send("OK");
    }

    // Security: Verify payment status directly with PagBank API
    const { isPaid } = await verifyPagBankOrder(rental.payment_id);

    if (isPaid && rental.payment_status !== "PAID") {
      await RentalModel.updatePayment(rentalId, {
        payment_status: "PAID",
        status: "pending", // "Aguardando empresa"
      });
      console.log(`[Webhook] Order ${rentalId} payment verified with PagBank. Status updated to pending.`);
    }

    // Always return 200 so PagBank knows we received it
    res.status(200).send("OK");
  } catch (error) {
    console.error("[Webhook Error]:", error);
    // Still return 200 so PagBank doesn't retry unnecessarily
    res.status(200).send("Error processed");
  }
});

export default router;
