import { Router } from "express";
import { DelivererController } from "../controllers/deliverer.controller";
import { verifySupabaseToken } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", verifySupabaseToken, DelivererController.create);
router.get("/company/:companyId", verifySupabaseToken, DelivererController.list);
router.put("/:id", verifySupabaseToken, DelivererController.update);
router.delete("/:id", verifySupabaseToken, DelivererController.remove);

export default router;
