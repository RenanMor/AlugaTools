import { Router, Request, Response } from "express";
import { RentalModel } from "../models/rental.model";

const router = Router();

router.post("/pagbank", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    
    // PagBank webhook payload typically has 'reference_id' and 'charges' array
    const referenceId = payload.reference_id;
    const charges = payload.charges || [];

    if (!referenceId || !referenceId.startsWith("rental_")) {
      return res.status(400).json({ error: "Invalid reference_id" });
    }

    const rentalId = referenceId.replace("rental_", "");
    
    // We only care if there is at least one paid charge or authorized
    const isPaid = charges.some((charge: any) => 
      charge.status === "PAID" || charge.status === "AUTHORIZED"
    );

    if (isPaid) {
      await RentalModel.updatePayment(rentalId, {
        payment_status: "PAID",
        status: "pending", // "Aguardando empresa"
      });
      console.log(`[Webhook] Order ${rentalId} payment confirmed. Status updated to pending.`);
    }

    // Always return 200 so PagBank knows we received it
    res.status(200).send("OK");
  } catch (error) {
    console.error("[Webhook Error]:", error);
    // Still return 200 so PagBank doesn't retry unnecessarily, or 500 if we want retries
    res.status(200).send("Error processed");
  }
});

export default router;
