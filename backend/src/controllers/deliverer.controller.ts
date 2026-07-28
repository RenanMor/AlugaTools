import { Request, Response, NextFunction } from "express";
import { DelivererModel } from "../models/deliverer.model";
import { supabaseAdmin } from "../config/supabase";

/**
 * Helper: verify that the authenticated user owns a given company.
 */
async function verifyCompanyOwnership(userId: string, companyId: string): Promise<boolean> {
  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("owner_id", userId)
    .maybeSingle();

  return !!company;
}

export const DelivererController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId as string;
      const { company_id, name, email, phone, password } = req.body;

      if (!company_id || !name || !email || !phone || !password) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios: nome, email, telefone e senha" });
      }

      // Security: verify user owns this company
      if (!(await verifyCompanyOwnership(userId, company_id))) {
        return res.status(403).json({ error: "Não autorizado: você não é dono desta empresa" });
      }

      // 1. Create Supabase Auth user for the deliverer
      const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, profile: "deliverer", phone },
      });

      if (authError || !userData.user) {
        return res.status(400).json({ error: authError?.message || "Erro ao criar usuário do entregador" });
      }

      // 2. Create user in public.users table
      const { error: dbError } = await supabaseAdmin
        .from("users")
        .insert({
          id: userData.user.id,
          name,
          email,
          profile: "deliverer",
          phone,
          role: "deliverer",
        });

      if (dbError) {
        await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
        return res.status(400).json({ error: dbError.message });
      }

      // 3. Create deliverer record linked to company
      const deliverer = await DelivererModel.create({
        company_id,
        user_id: userData.user.id,
        name,
        email,
        phone,
      });

      res.status(201).json({ data: deliverer });
    } catch (err) {
      next(err);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId as string;
      const { companyId } = req.params;

      // Security: verify user owns this company
      if (!(await verifyCompanyOwnership(userId, companyId))) {
        return res.status(403).json({ error: "Não autorizado: você não é dono desta empresa" });
      }

      const deliverers = await DelivererModel.findByCompany(companyId);
      res.json({ data: deliverers });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;
      const { name, email, phone, active } = req.body;

      // Security: verify user owns the company this deliverer belongs to
      const deliverer = await DelivererModel.findById(id);
      if (!deliverer) {
        return res.status(404).json({ error: "Entregador não encontrado" });
      }
      if (!(await verifyCompanyOwnership(userId, deliverer.company_id))) {
        return res.status(403).json({ error: "Não autorizado: você não é dono desta empresa" });
      }

      const updated = await DelivererModel.update(id, { name, email, phone, active });
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId as string;
      const { id } = req.params;

      // Find the deliverer to get user_id and verify ownership
      const deliverer = await DelivererModel.findById(id);
      if (!deliverer) {
        return res.status(404).json({ error: "Entregador não encontrado" });
      }

      // Security: verify user owns the company this deliverer belongs to
      if (!(await verifyCompanyOwnership(userId, deliverer.company_id))) {
        return res.status(403).json({ error: "Não autorizado: você não é dono desta empresa" });
      }

      // Delete the deliverer record
      await DelivererModel.remove(id);

      // Optionally deactivate the auth user (soft delete)
      if (deliverer.user_id) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(deliverer.user_id);
          await supabaseAdmin.from("users").delete().eq("id", deliverer.user_id);
        } catch (e) {
          console.warn("Could not delete deliverer auth user:", e);
        }
      }

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
