import express from "express";
import helmet from "helmet";
import cors from "cors";
import routes from "./routes";
import { apiRateLimiter } from "./middlewares/rateLimit.middleware";
import { errorHandler, notFound } from "./middlewares/error.middleware";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(apiRateLimiter);

  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api", routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
