import { Router } from "express";
import { RentalController } from "../controllers/rental.controller";
import { verifySupabaseToken } from "../middlewares/auth.middleware";

const router = Router();

router.post("/", verifySupabaseToken, RentalController.create);
router.get("/me", verifySupabaseToken, RentalController.listByCustomer);
router.get("/company/:companyId", verifySupabaseToken, RentalController.listByCompany);
router.patch("/:id/status", verifySupabaseToken, RentalController.updateStatus);
router.patch("/:id/rating", verifySupabaseToken, RentalController.rate);

export default router;
