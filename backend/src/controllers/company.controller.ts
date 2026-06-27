import { Request, Response, NextFunction } from "express";
import { CompanyModel } from "../models/company.model";

export const CompanyController = {
  async getFeatured(_req: Request, res: Response, next: NextFunction) {
    try {
      const companies = await CompanyModel.findFeatured(10);
      res.json({ data: companies });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const company = await CompanyModel.findById(req.params.id);
      if (!company) return res.status(404).json({ error: "Empresa não encontrada" });
      res.json({ data: company });
    } catch (err) {
      next(err);
    }
  },

  async getByCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const companies = await CompanyModel.findByCategory(req.params.categoryId);
      res.json({ data: companies });
    } catch (err) {
      next(err);
    }
  },
};
