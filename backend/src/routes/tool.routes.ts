import { Router } from "express";
import { ToolController } from "../controllers/tool.controller";
import { verifySupabaseToken } from "../middlewares/auth.middleware";

import { supabaseAdmin } from "../config/supabase";

const router = Router();

router.get("/debug-schema", async (req, res) => {
  try {
    const { data: rows, error } = await supabaseAdmin.from("tools").select("*").limit(1);
    if (error) throw error;
    res.json({
      keys: rows && rows.length > 0 ? Object.keys(rows[0]) : [],
      row: rows && rows.length > 0 ? rows[0] : null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/", ToolController.listAll);
router.get("/:id", ToolController.getById);
router.get("/:id/reviews", ToolController.getReviews);
router.get("/company/:companyId", ToolController.listByCompany);
router.post("/", verifySupabaseToken, ToolController.create);
router.put("/:id", verifySupabaseToken, ToolController.update);
router.delete("/:id", verifySupabaseToken, ToolController.remove);

export default router;
