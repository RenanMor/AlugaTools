import { Router, Request, Response, NextFunction } from "express";
import { CompanyModel } from "../models/company.model";
import { RentalModel } from "../models/rental.model";
import { verifySupabaseToken, verifyOwner } from "../middlewares/auth.middleware";
import { supabaseAdmin } from "../config/supabase";

const router = Router();

// Apply auth & owner middlewares to all admin routes
router.use(verifySupabaseToken, verifyOwner);

// 1. List all companies
router.get("/companies", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const companies = await CompanyModel.findAll();
    res.json({ data: companies });
  } catch (err) {
    next(err);
  }
});

// 2. Approve or Reject a company
router.patch("/companies/:id/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== "approved" && status !== "rejected") {
      return res.status(400).json({ error: "Status inválido. Deve ser 'approved' ou 'rejected'." });
    }

    const company = await CompanyModel.updateStatus(id, status);
    res.json({ data: company });
  } catch (err) {
    next(err);
  }
});

// 3. List rentals of a specific company
router.get("/companies/:companyId/rentals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { companyId } = req.params;
    const rentals = await RentalModel.findByCompany(companyId);
    res.json({ data: rentals });
  } catch (err) {
    next(err);
  }
});

// 4. Cancel a rental from any company (admin override)
router.post("/companies/:companyId/rentals/:rentalId/cancel", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { rentalId } = req.params;
    const adminUserId = (req as any).userId as string;

    // Fetch admin name for cancellation tracking
    const { data: adminUser } = await supabaseAdmin
      .from("users")
      .select("name")
      .eq("id", adminUserId)
      .single();

    const updated = await RentalModel.cancelAndRestore(
      rentalId,
      adminUserId,
      `Admin: ${adminUser?.name || "Administrador"}`
    );
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// 5. Create Asaas Subaccount on-demand by Admin (costs R$ 13 / controlled by Admin)
router.post("/companies/:id/create-subaccount", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Fetch company with owner details
    const { data: company, error: compErr } = await supabaseAdmin
      .from("companies")
      .select("*, users(name, email, cnpj, cpf, phone)")
      .eq("id", id)
      .single();

    if (compErr || !company) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    if (company.asaas_account_id && company.asaas_wallet_id) {
      return res.status(400).json({
        error: "Esta empresa já possui subconta Asaas ativa.",
        walletId: company.asaas_wallet_id,
        accountId: company.asaas_account_id,
      });
    }

    const ownerName = company.name || company.users?.name || "Empresa";
    const ownerEmail = company.users?.email || "";
    const rawDoc = company.cnpj || company.users?.cnpj || company.users?.cpf || "";
    const cleanDoc = rawDoc.replace(/\D/g, "");
    const cleanPhone = (company.phone || company.users?.phone || "").replace(/\D/g, "");

    if (!cleanDoc || cleanDoc.length < 11) {
      return res.status(400).json({
        error: "CPF ou CNPJ inválido ou ausente no cadastro da empresa.",
      });
    }

    if (!ownerEmail) {
      return res.status(400).json({
        error: "E-mail ausente no cadastro da empresa.",
      });
    }

    const { createAsaasSubaccount } = await import("../utils/asaas");

    const subaccount = await createAsaasSubaccount({
      name: ownerName,
      email: ownerEmail,
      cpfCnpj: cleanDoc,
      mobilePhone: cleanPhone || undefined,
      phone: cleanPhone || undefined,
      postalCode: company.postal_code || undefined,
      address: company.address_street || company.location || undefined,
      addressNumber: company.address_number || undefined,
      province: company.neighborhood || undefined,
      companyType: cleanDoc.length === 14 ? "LIMITED" : "MEI",
    });

    // Save subaccount details to company record
    await CompanyModel.updateAsaasData(id, {
      asaas_account_id: subaccount.accountId,
      asaas_wallet_id: subaccount.walletId,
      asaas_api_key: subaccount.apiKey,
      asaas_status: "active",
    });

    console.log(`[Admin] ✅ Created Asaas subaccount for company ${id} (${ownerName}): walletId=${subaccount.walletId}`);

    res.json({
      success: true,
      data: {
        accountId: subaccount.accountId,
        walletId: subaccount.walletId,
        status: "active",
      },
    });
  } catch (err: any) {
    console.error("[Admin.createSubaccount] Error:", err);
    // Mark as error in company record if failed
    try {
      await CompanyModel.updateAsaasData(req.params.id, { asaas_status: "error" });
    } catch {}
    next(err);
  }
});

// 6. Trigger Subaccount Payout / Transfer to Bank or Pix Key
router.post("/companies/:id/transfer-funds", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { value, description } = req.body;

    if (!value || Number(value) <= 0) {
      return res.status(400).json({ error: "Valor de transferência inválido" });
    }

    const { data: company, error: compErr } = await supabaseAdmin
      .from("companies")
      .select("*")
      .eq("id", id)
      .single();

    if (compErr || !company) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    if (!company.asaas_api_key) {
      return res.status(400).json({ error: "A empresa não possui subconta Asaas ativa para realizar transferências." });
    }

    const { transferSubaccountFunds } = await import("../utils/asaas");

    let transferResult;
    if (company.pix_key && company.pix_key_type) {
      transferResult = await transferSubaccountFunds(company.asaas_api_key, {
        value: Number(value),
        description: description || "Repasse AlugaTools",
        pixAddressKey: company.pix_key,
        pixAddressKeyType: company.pix_key_type as any,
      });
    } else if (company.bank_code && company.bank_account && company.bank_agency) {
      transferResult = await transferSubaccountFunds(company.asaas_api_key, {
        value: Number(value),
        description: description || "Repasse AlugaTools",
        bankAccount: {
          bank: { code: company.bank_code },
          ownerName: company.bank_owner_name || company.name,
          cpfCnpj: (company.bank_cpf_cnpj || company.cnpj || "").replace(/\D/g, ""),
          agency: company.bank_agency,
          account: company.bank_account,
          accountDigit: company.bank_account_digit || "0",
          bankAccountType: (company.bank_account_type as any) || "CONTA_CORRENTE",
        },
      });
    } else {
      return res.status(400).json({
        error: "A empresa não possui Chave Pix nem dados bancários cadastrados para repasse.",
      });
    }

    res.json({ success: true, data: transferResult });
  } catch (err) {
    next(err);
  }
});

// 7. Query Subaccount Balance (for admin monitoring)
router.get("/companies/:id/balance", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const { data: company, error: compErr } = await supabaseAdmin
      .from("companies")
      .select("name, asaas_api_key, asaas_wallet_id, asaas_status, pix_key, pix_key_type, bank_code, bank_agency, bank_account")
      .eq("id", id)
      .single();

    if (compErr || !company) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    if (!company.asaas_api_key) {
      return res.status(400).json({
        error: "A empresa não possui subconta Asaas ativa.",
        asaasStatus: company.asaas_status || "not_created",
      });
    }

    const { getSubaccountBalance } = await import("../utils/asaas");
    const balance = await getSubaccountBalance(company.asaas_api_key);

    res.json({
      data: {
        companyName: company.name,
        walletId: company.asaas_wallet_id,
        balance: balance.balance,
        availableBalance: balance.availableBalance,
        pendingBalance: balance.pendingBalance,
        payoutInfo: {
          hasPixKey: !!(company.pix_key && company.pix_key_type),
          pixKeyType: company.pix_key_type || null,
          pixKey: company.pix_key || null,
          hasBankAccount: !!(company.bank_code && company.bank_account),
          bankCode: company.bank_code || null,
          bankAgency: company.bank_agency || null,
          bankAccount: company.bank_account || null,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
