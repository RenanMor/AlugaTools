import { Router, Request, Response, NextFunction } from "express";
import { CompanyController } from "../controllers/company.controller";
import { verifySupabaseToken } from "../middlewares/auth.middleware";
import { supabaseAdmin } from "../config/supabase";

const router = Router();

router.get("/featured", CompanyController.getFeatured);
router.get("/category/:categoryId", CompanyController.getByCategory);
router.get("/:id", CompanyController.getById);

router.put("/:id", verifySupabaseToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, logo, description, category_id, location, state, city, is_open } = req.body;
    
    // Check if user owns this company
    const userId = (req as any).userId;
    const { data: company, error: fetchError } = await supabaseAdmin
      .from("companies")
      .select("owner_id")
      .eq("id", id)
      .single();

    if (fetchError || !company) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    if (company.owner_id !== userId) {
      return res.status(403).json({ error: "Não autorizado" });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name.replace(/^Locações\s+/i, "").replace(/\s+Locações$/i, "");
    if (logo !== undefined) updates.logo = logo;
    if (description !== undefined) updates.description = description;
    if (category_id !== undefined) updates.category_id = category_id;
    if (location !== undefined) updates.location = location;
    if (state !== undefined) updates.state = state;
    if (city !== undefined) updates.city = city;
    if (is_open !== undefined) updates.is_open = is_open;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("companies")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
