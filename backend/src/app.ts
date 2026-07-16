import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import routes from "./routes";
import { apiRateLimiter } from "./middlewares/rateLimit.middleware";
import { errorHandler, notFound } from "./middlewares/error.middleware";
import { RentalModel } from "./models/rental.model";

export function createApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: false, // Allows images to be fetched by frontend
    })
  );
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, true);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(apiRateLimiter);

  // Serve uploaded images statically
  app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  // Background task to clean up expired awaiting_payment rentals and restore stock (every 2 minutes)
  setInterval(() => {
    RentalModel.cancelExpired().catch((err) => {
      console.error("[Cleanup] error in cancelExpired:", err);
    });
  }, 120000);

  // Background task to detect active rentals whose usage period expired → mark as return_expired (every 5 minutes)
  setInterval(() => {
    RentalModel.checkExpiredActiveRentals()
      .then((expired) => {
        if (expired.length > 0) {
          expired.forEach((r) => {
            console.log(
              `[Return] Pedido ${r.id} (${r.tool?.name || r.tool_id}) da empresa ${r.company?.name || r.company_id} marcado como return_expired. Cliente: ${r.customer?.name || r.customer_id}.`
            );
          });
        }
      })
      .catch((err) => {
        console.error("[Cleanup] error in checkExpiredActiveRentals:", err);
      });
  }, 5 * 60 * 1000); // 5 minutes

  return app;
}
