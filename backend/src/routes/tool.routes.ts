import { Router } from "express";
import { ToolController } from "../controllers/tool.controller";
import { verifySupabaseToken } from "../middlewares/auth.middleware";

const router = Router();

router.get("/company/:companyId", ToolController.listByCompany);
router.post("/", verifySupabaseToken, ToolController.create);
router.put("/:id", verifySupabaseToken, ToolController.update);
router.delete("/:id", verifySupabaseToken, ToolController.remove);

export default router;
