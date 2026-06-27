import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const status = (err as any).status || 500;
  res.status(status).json({
    error: err.message || "Erro interno do servidor",
  });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Rota não encontrada" });
}
