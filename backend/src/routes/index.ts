import { Router } from "express";
import authRoutes from "./auth.routes";
import companyRoutes from "./company.routes";
import toolRoutes from "./tool.routes";
import rentalRoutes from "./rental.routes";
import cepRoutes from "./cep.routes";
import webhookRoutes from "./webhook.routes";
import delivererRoutes from "./deliverer.routes";
import adminRoutes from "./admin.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/companies", companyRoutes);
router.use("/tools", toolRoutes);
router.use("/rentals", rentalRoutes);
router.use("/cep", cepRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/deliverers", delivererRoutes);
router.use("/admin", adminRoutes);

export default router;
