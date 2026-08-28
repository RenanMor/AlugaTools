import { Router, Request, Response, NextFunction } from "express";
import { CompanyController } from "../controllers/company.controller";
import { verifySupabaseToken } from "../middlewares/auth.middleware";
import { supabaseAdmin } from "../config/supabase";

const router = Router();

router.get("/featured", CompanyController.getFeatured);
router.get("/category/:categoryId", CompanyController.getByCategory);
router.get("/:id", CompanyController.getById);

// Endpoint to validate Pix Key via DICT (Banco Central) through Asaas (público para uso no cadastro)
router.post("/validate-pix", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, key } = req.body;
    if (!type || !key) {
      return res.status(400).json({ error: "Tipo e chave Pix são obrigatórios" });
    }

    const validTypes = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Tipo de chave inválido. Aceitos: ${validTypes.join(", ")}` });
    }

    const { validateAsaasPixKey } = await import("../utils/asaas");
    const result = await validateAsaasPixKey(type, key);
    console.log(`[API validate-pix] Result for ${type}: ${key} -> valid: ${result.valid}, name: ${result.name}`);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", verifySupabaseToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      name,
      logo,
      description,
      category_id,
      location,
      state,
      city,
      is_open,
      // Address fields for onboarding
      postal_code,
      address_street,
      address_number,
      neighborhood,
      // Pix & Banking details
      pix_key_type,
      pix_key,
      bank_code,
      bank_agency,
      bank_account,
      bank_account_digit,
      bank_account_type,
      bank_owner_name,
      bank_cpf_cnpj,
    } = req.body;

    // Check if user owns this company
    const userId = (req as any).userId;
    const { data: company, error: fetchError } = await supabaseAdmin
      .from("companies")
      .select("owner_id")
      .eq("id", id)
      .single();

    if (fetchError || !company) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    if (company.owner_id !== userId) {
      return res.status(403).json({ error: "Não autorizado" });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name.replace(/^ \s+/i, "").replace(/\s+ $/i, "");
    if (logo !== undefined) updates.logo = logo;
    if (description !== undefined) updates.description = description;
    if (category_id !== undefined) updates.category_id = category_id;
    if (location !== undefined) updates.location = location;
    if (state !== undefined) updates.state = state;
    if (city !== undefined) updates.city = city;
    if (is_open !== undefined) updates.is_open = is_open;

    // Address
    if (postal_code !== undefined) updates.postal_code = postal_code;
    if (address_street !== undefined) updates.address_street = address_street;
    if (address_number !== undefined) updates.address_number = address_number;
    if (neighborhood !== undefined) updates.neighborhood = neighborhood;

    // Banking & Pix
    if (pix_key_type !== undefined) updates.pix_key_type = pix_key_type;
    if (pix_key !== undefined) updates.pix_key = pix_key;
    if (bank_code !== undefined) updates.bank_code = bank_code;
    if (bank_agency !== undefined) updates.bank_agency = bank_agency;
    if (bank_account !== undefined) updates.bank_account = bank_account;
    if (bank_account_digit !== undefined) updates.bank_account_digit = bank_account_digit;
    if (bank_account_type !== undefined) updates.bank_account_type = bank_account_type;
    if (bank_owner_name !== undefined) updates.bank_owner_name = bank_owner_name;
    if (bank_cpf_cnpj !== undefined) updates.bank_cpf_cnpj = bank_cpf_cnpj;

    // Validate Pix key via DICT (Banco Central) when pix_key is being set
    if (pix_key && pix_key_type) {
      try {
        const { validateAsaasPixKey } = await import("../utils/asaas");
        const validation = await validateAsaasPixKey(pix_key_type, pix_key);
        if (!validation.valid) {
          return res.status(400).json({
            error: `Chave Pix inválida: ${validation.errorMessage || "Não encontrada no Banco Central"}`,
            pixValidation: validation,
          });
        }
        // Enrich with validated holder data if not provided
        if (!bank_owner_name && validation.name) {
          updates.bank_owner_name = validation.name;
        }
        if (!bank_cpf_cnpj && validation.cpfCnpj) {
          updates.bank_cpf_cnpj = validation.cpfCnpj;
        }
        console.log(`[Company] ✅ Pix key validated for company ${id}: ${pix_key_type} ${pix_key} → ${validation.name}`);
      } catch (pixErr: any) {
        console.warn(`[Company] Pix validation warning for ${id}:`, pixErr.message);
        // Don't block the update if validation service is unavailable
      }
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("companies")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
