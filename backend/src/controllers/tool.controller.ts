import { Request, Response, NextFunction } from "express";
import { ToolModel } from "../models/tool.model";

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
      console.log("[ToolController] create body:", req.body);
      const tool = await ToolModel.create(req.body);
      console.log("[ToolController] create success:", tool);
      res.status(201).json({ data: tool });
    } catch (err) {
      console.error("[ToolController] create error:", err);
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const tool = await ToolModel.update(req.params.id, req.body);
      res.json({ data: tool });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await ToolModel.remove(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
