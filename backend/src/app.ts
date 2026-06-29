import express from "express";
import helmet from "helmet";
import cors from "cors";
import routes from "./routes";
import { apiRateLimiter } from "./middlewares/rateLimit.middleware";
import { errorHandler, notFound } from "./middlewares/error.middleware";
import { RentalModel } from "./models/rental.model";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        callback(null, true);
      },
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(apiRateLimiter);

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  // Background task to clean up expired rentals and restore stock
  setInterval(() => {
    RentalModel.cancelExpired().catch((err) => {
      console.error("[Cleanup] error in cancelExpired:", err);
    });
  }, 120000); // 2 minutes

  return app;
}
