import { Router } from "express";
import { CompanyController } from "../controllers/company.controller";

const router = Router();

router.get("/featured", CompanyController.getFeatured);
router.get("/category/:categoryId", CompanyController.getByCategory);
router.get("/:id", CompanyController.getById);

export default router;
