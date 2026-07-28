import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const status = (err as any).status || 500;

  // In production, never expose internal error details to the client
  const isProduction = process.env.NODE_ENV === "production";

  if (status >= 500) {
    // Log the full error server-side for debugging
    console.error("[Error]", err.message, err.stack);

    res.status(status).json({
      error: isProduction
        ? "Erro interno do servidor"
        : err.message || "Erro interno do servidor",
    });
  } else {
    // 4xx errors are safe to expose (validation, auth, etc.)
    res.status(status).json({
      error: err.message || "Erro na requisição",
    });
  }
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Rota não encontrada" });
}
