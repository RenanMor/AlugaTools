import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import routes from "./routes";
import { apiRateLimiter } from "./middlewares/rateLimit.middleware";
import { errorHandler, notFound } from "./middlewares/error.middleware";
import { RentalModel } from "./models/rental.model";
import { env } from "./config/env";

export function createApp() {
  const app = express();

  // Trust proxy for reverse proxies (Render, Vercel, Cloudflare, etc.) to allow rate-limiting by real client IP
  app.set("trust proxy", 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: false, // Allows images to be fetched by frontend
    })
  );
  // CORS: restrict to allowed origins
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  // Default allowed origins for development and production
  const defaultOrigins = [
    "http://localhost:8081",
    "http://localhost:3000",
    "http://localhost:4000",
    "http://10.0.2.2:4000",
    "https://aluga-tools.vercel.app",
  ];
  if (env.nodeEnv === "production" && allowedOrigins.length === 0) {
    console.warn("[Security] CORS_ALLOWED_ORIGINS not set in production. Using default allowed origins.");
  }
  const origins = allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins;

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, curl)
        if (!origin) return callback(null, true);
        if (origins.includes(origin) || origin.endsWith(".vercel.app")) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
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
