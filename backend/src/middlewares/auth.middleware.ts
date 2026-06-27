import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";

export async function verifySupabaseToken(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token de autenticação ausente" });
  }

  const token = header.replace("Bearer ", "");
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  (req as any).userId = data.user.id;
  (req as any).user = data.user;
  next();
}
