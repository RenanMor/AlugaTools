import { Request, Response, NextFunction } from "express";
import { ToolModel } from "../models/tool.model";
import { supabaseAdmin } from "../config/supabase";

/**
 * Helper: verify that the authenticated user owns the company that owns the tool.
 * Returns true if authorized, false otherwise.
 */
async function verifyToolOwnership(userId: string, toolId: string): Promise<boolean> {
  const tool = await ToolModel.findById(toolId);
  if (!tool) return false;

  const { data: company } = await supabaseAdmin
    .from("companies")
    .select("id")
    .eq("id", tool.company_id)
    .eq("owner_id", userId)
    .maybeSingle();

  return !!company;
}

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

export const ToolController = {
  async listAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const tools = await ToolModel.findAll();
      res.json({ data: tools });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const tool = await ToolModel.findById(req.params.id);
      if (!tool) return res.status(404).json({ error: "Ferramenta não encontrada" });
      res.json({ data: tool });
    } catch (err) {
      next(err);
    }
  },

  async listByCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const tools = await ToolModel.findByCompany(req.params.companyId);
      res.json({ data: tools });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId as string;
      const { company_id } = req.body;

      // Security: verify user owns this company
      if (!company_id || !(await verifyCompanyOwnership(userId, company_id))) {
        return res.status(403).json({ error: "Não autorizado: você não é dono desta empresa" });
      }

      const tool = await ToolModel.create(req.body);
      res.status(201).json({ data: tool });
    } catch (err) {
      console.error("[ToolController] create error:", err);
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId as string;

      // Security: verify user owns the company that owns this tool
      if (!(await verifyToolOwnership(userId, req.params.id))) {
        return res.status(403).json({ error: "Não autorizado: você não é dono desta ferramenta" });
      }

      const tool = await ToolModel.update(req.params.id, req.body);
      res.json({ data: tool });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).userId as string;

      // Security: verify user owns the company that owns this tool
      if (!(await verifyToolOwnership(userId, req.params.id))) {
        return res.status(403).json({ error: "Não autorizado: você não é dono desta ferramenta" });
      }

      await ToolModel.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async getReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { data, error } = await supabaseAdmin
        .from("rentals")
        .select("id, rating, rating_comment, created_at, customer_id")
        .eq("tool_id", id)
        .not("rating", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      const customerIds = Array.from(new Set((data || []).map((r: any) => r.customer_id).filter(Boolean)));
      let userMap: Record<string, string> = {};
      if (customerIds.length > 0) {
        const { data: users } = await supabaseAdmin.from("users").select("id, name").in("id", customerIds);
        (users || []).forEach((u: any) => { userMap[u.id] = u.name; });
      }

      const reviews = (data || []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        comment: r.rating_comment || "",
        createdAt: new Date(r.created_at).getTime(),
        customerName: userMap[r.customer_id] || "Cliente Anônimo",
      }));

      res.json({ data: reviews });
    } catch (err) {
      next(err);
    }
  },
};
