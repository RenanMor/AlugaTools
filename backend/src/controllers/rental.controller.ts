import { Request, Response, NextFunction } from "express";
import { RentalModel } from "../models/rental.model";
import { CompanyModel } from "../models/company.model";
import { createPagBankCharge } from "../utils/pagbank";

export const RentalController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { tool_id, company_id, days, total_price } = req.body;
      const customerId = (req as any).userId as string;

      const charge = await createPagBankCharge({
        amount: Math.round(total_price * 100),
        description: `Aluguel de ferramenta ${tool_id}`,
        referenceId: `rental_${Date.now()}`,
      });

      const rental = await RentalModel.create({
        tool_id,
        company_id,
        customer_id: customerId,
        days,
        total_price,
        status: "pending",
      });

      res.status(201).json({ data: rental, payment: charge });
    } catch (err) {
      next(err);
    }
  },

  async listByCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = (req as any).userId as string;
      const rentals = await RentalModel.findByCustomer(customerId);
      res.json({ data: rentals });
    } catch (err) {
      next(err);
    }
  },

  async listByCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const rentals = await RentalModel.findByCompany(req.params.companyId);
      res.json({ data: rentals });
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const rental = await RentalModel.updateStatus(req.params.id, req.body.status);
      res.json({ data: rental });
    } catch (err) {
      next(err);
    }
  },

  async rate(req: Request, res: Response, next: NextFunction) {
    try {
      const rental = await RentalModel.setRating(req.params.id, req.body.rating);
      await CompanyModel.recalcRating(rental.company_id);
      res.json({ data: rental });
    } catch (err) {
      next(err);
    }
  },
};
