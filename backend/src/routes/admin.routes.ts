import { Router, Request, Response, NextFunction } from "express";
import { CompanyModel } from "../models/company.model";
import { RentalModel } from "../models/rental.model";
import { verifySupabaseToken, verifyOwner } from "../middlewares/auth.middleware";
import { supabaseAdmin } from "../config/supabase";

const router = Router();

// Apply auth & owner middlewares to all admin routes
router.use(verifySupabaseToken, verifyOwner);

// 1. List all companies
router.get("/companies", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companies = await CompanyModel.findAll();
    res.json({ data: companies });
  } catch (err) {
    next(err);
  }
});

// 2. Approve or Reject a company
router.patch("/companies/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ error: "Status inválido. Deve ser 'approved' ou 'rejected'." });
    }

    const company = await CompanyModel.updateStatus(id, status);
    res.json({ data: company });
  } catch (err) {
    next(err);
  }
});

// 3. List rentals of a specific company
router.get("/companies/:companyId/rentals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.params;
    const rentals = await RentalModel.findByCompany(companyId);
    res.json({ data: rentals });
  } catch (err) {
    next(err);
  }
});

// 4. Cancel a rental from any company (admin override)
router.post("/companies/:companyId/rentals/:rentalId/cancel", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rentalId } = req.params;
    
    const rental = await RentalModel.findById(rentalId);
    if (!rental) {
      return res.status(404).json({ error: "Pedido não encontrado" });
    }

    // Restore stock if the rental is not already cancelled
    if (rental.status !== "cancelled") {
      const { data: toolData } = await supabaseAdmin
        .from("tools")
        .select("quantity")
        .eq("id", rental.tool_id)
        .single();

      if (toolData) {
        const newQty = (toolData.quantity || 0) + 1;
        await supabaseAdmin
          .from("tools")
          .update({ quantity: newQty, available: true })
          .eq("id", rental.tool_id);
      }
    }

    const updated = await RentalModel.updateStatus(rentalId, "cancelled");
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
