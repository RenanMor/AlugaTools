import { Router } from "express";
import companyRoutes from "./company.routes";
import toolRoutes from "./tool.routes";
import rentalRoutes from "./rental.routes";

const router = Router();

router.use("/companies", companyRoutes);
router.use("/tools", toolRoutes);
router.use("/rentals", rentalRoutes);

export default router;
