import { Request, Response, NextFunction } from "express";
import { CompanyModel } from "../models/company.model";
import { supabaseAdmin } from "../config/supabase";
import { CacheKeys, CATALOG_TTL_MS, cached } from "../utils/cache";

/**
 * Fields anyone can see. Banking/Pix data, Asaas credentials, address and fees
 * are private: they used to be returned by these public endpoints.
 */
const PUBLIC_FIELDS = [
  "id", "name", "logo", "description", "category_id", "location", "state", "city",
  "is_open", "rating", "rating_count", "status", "primary_color", "secondary_color", "created_at",
];

export function toPublicCompany(company: any) {
  if (!company) return company;
  const out: Record<string, unknown> = {};
  for (const key of PUBLIC_FIELDS) if (key in company) out[key] = company[key];
  return out;
}

/** Private view for the company owner and platform admins. The Asaas API key never leaves the server. */
function toPrivateCompany(company: any) {
  if (!company) return company;
  const { asaas_api_key, ...rest } = company;
  return rest;
}

async function canSeePrivate(req: Request, company: any): Promise<boolean> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return false;
  const { data, error } = await supabaseAdmin.auth.getUser(header.slice(7));
  if (error || !data.user) return false;
  if (company.owner_id === data.user.id) return true;
  const { data: dbUser } = await supabaseAdmin.from("users").select("is_owner").eq("id", data.user.id).single();
  return !!dbUser?.is_owner;
}

export const CompanyController = {
  async getFeatured(_req: Request, res: Response, next: NextFunction) {
    try {
      const companies = await cached(`${CacheKeys.companies}featured`, CATALOG_TTL_MS, async () =>
        (await CompanyModel.findFeatured(10)).map(toPublicCompany),
      );
      res.json({ data: companies });
    } catch (err) {
      next(err);
    }
  },

  /** GET /:id → public fields. GET /:id?private=1 with the owner's (or an admin's) token → banking/Pix too. */
  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (req.query.private) {
        const company = await CompanyModel.findById(id);
        if (!company) return res.status(404).json({ error: "Empresa não encontrada" });
        if (!(await canSeePrivate(req, company))) return res.status(403).json({ error: "Acesso negado" });
        return res.json({ data: toPrivateCompany(company) });
      }

      const company = await cached(`${CacheKeys.companies}id:${id}`, CATALOG_TTL_MS, async () =>
        toPublicCompany(await CompanyModel.findById(id)),
      );
      if (!company) return res.status(404).json({ error: "Empresa não encontrada" });
      res.json({ data: company });
    } catch (err) {
      next(err);
    }
  },

  async getByCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { categoryId } = req.params;
      const companies = await cached(`${CacheKeys.companies}category:${categoryId}`, CATALOG_TTL_MS, async () =>
        (await CompanyModel.findByCategory(categoryId)).map(toPublicCompany),
      );
      res.json({ data: companies });
    } catch (err) {
      next(err);
    }
  },
};
