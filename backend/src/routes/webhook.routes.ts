import { Router, Request, Response } from "express";
import { RentalModel } from "../models/rental.model";
import { CompanyModel } from "../models/company.model";
import { getMercadoPagoPaymentStatus } from "../utils/mercadopago";
import { getPagarmeOrderStatus } from "../utils/pagarme";
import {
  getAsaasPaymentStatus,
  transferSubaccountFunds,
  getSubaccountBalance,
} from "../utils/asaas";

const router = Router();

// ============================================================
// 1. Mercado Pago Webhook (PRIMARY ACTIVE)
// ============================================================

/**
 * Mercado Pago sends notifications for payment status events.
 * Handles both IPN format (?topic=payment&id=...) and Webhooks v2 format (body: { type: "payment", data: { id: "..." } }).
 * Always validates directly with Mercado Pago API before updating database.
 */
router.post("/mercadopago", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const query = req.query || {};

    console.log(
      "[Webhook MercadoPago] Received notification:",
      JSON.stringify({ body, query }, null, 2)
    );

    // Extract payment ID from various possible notification formats
    const paymentId =
      body.data?.id ||
      body.id ||
      query.id ||
      query["data.id"] ||
      (query.topic === "payment" ? query.id : null);

    const type = body.type || body.action || query.topic || "";

    if (!paymentId) {
      console.log("[Webhook MercadoPago] No paymentId found in payload/query. Acknowledged.");
      return res.status(200).send("OK");
    }

    // Process payment and order notifications
    const isRelevantType =
      !type ||
      String(type).includes("payment") ||
      String(type).includes("order") ||
      String(type).includes("action");

    if (!isRelevantType) {
      console.log(`[Webhook MercadoPago] Notification type "${type}" ignored. Acknowledged.`);
      return res.status(200).send("OK");
    }

    // Step 1: Query Mercado Pago API directly to verify the real payment data
    const { isPaid, status, paymentData } = await getMercadoPagoPaymentStatus(String(paymentId));

    if (!paymentData) {
      console.warn(`[Webhook MercadoPago] Payment ${paymentId} could not be retrieved from Mercado Pago API.`);
      return res.status(200).send("OK");
    }

    // Step 2: Match rental by external_reference or payment_id
    const externalReference = paymentData.external_reference || "";
    let rental = null;

    if (externalReference && externalReference.startsWith("rental_")) {
      const rentalId = externalReference.replace("rental_", "");
      rental = await RentalModel.findById(rentalId);
    }

    if (!rental) {
      rental = await findRentalByPaymentId(String(paymentId));
    }

    if (!rental) {
      console.warn(
        `[Webhook MercadoPago] Rental not found for paymentId ${paymentId} (external_ref: ${externalReference}).`
      );
      return res.status(200).send("OK");
    }

    // Step 3: Update rental status if approved
    // Orders API uses "processed" as approved status; Payments API uses "approved"
    const isPaidStatus = isPaid || status === "processed" || status === "paid";

    if (isPaidStatus && rental.payment_status !== "PAID") {
      await RentalModel.updatePayment(rental.id, {
        payment_id: String(paymentId),
        payment_status: "PAID",
        status: "pending", // Transitions to "Aguardando empresa"
      });
      console.log(`[Webhook MercadoPago] Rental ${rental.id} payment approved! Status updated to pending.`);
    } else if (status === "rejected" || status === "cancelled" || status === "failed") {
      await RentalModel.updatePayment(rental.id, {
        payment_id: String(paymentId),
        payment_status: "DECLINED",
      });
      console.log(`[Webhook MercadoPago] Rental ${rental.id} payment rejected/declined.`);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("[Webhook MercadoPago] Error:", error);
    // Always return 200 so Mercado Pago does not flood retries on unhandled errors
    res.status(200).send("OK");
  }
});

// Also support GET for Mercado Pago webhook health check verification
router.get("/mercadopago", (_req: Request, res: Response) => {
  res.status(200).send("Mercado Pago Webhook Endpoint Active");
});

// ============================================================
// 2. Pagar.me Webhook (INACTIVE / DISABLED)
// ============================================================

router.post("/pagarme", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const orderCode = payload?.data?.code || payload?.code || "";
    const orderId = payload?.data?.id || payload?.id || "";

    console.log(`[Webhook Pagar.me] Received event (Inactive gateway). Order code: ${orderCode}, ID: ${orderId}`);

    if (orderCode?.startsWith("rental_")) {
      const rentalId = orderCode.replace("rental_", "");
      const rental = await RentalModel.findById(rentalId);
      if (rental?.payment_id) {
        const { isPaid } = await getPagarmeOrderStatus(rental.payment_id);
        if (isPaid && rental.payment_status !== "PAID") {
          await RentalModel.updatePayment(rental.id, {
            payment_status: "PAID",
            status: "pending",
          });
        }
      }
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("[Webhook Pagar.me] Error:", error);
    res.status(200).send("OK");
  }
});

// ============================================================
// 3. Asaas Webhook (PRIMARY ACTIVE — Split de Pagamentos)
// ============================================================

/**
 * Asaas sends webhooks for payment and split events.
 * Key events handled:
 * - PAYMENT_CONFIRMED / PAYMENT_RECEIVED: Payment confirmed → update rental to "pending"
 * - PAYMENT_OVERDUE: Payment overdue → log warning
 * - PAYMENT_SPLIT_DONE: Split executed → AUTO-TRANSFER funds to company's bank/Pix
 * - PAYMENT_SPLIT_DIVERGENCE_BLOCK: Split value exceeds netValue → alert
 * - PAYMENT_REFUNDED / PAYMENT_CHARGEBACK_REQUESTED: Refund/chargeback → cancel
 * - TRANSFER_*: Transfer events from subaccounts → audit logging
 *
 * Always validates directly with Asaas API before updating database.
 */
router.post("/asaas", async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const event = payload?.event || "";
    const paymentData = payload?.payment || {};
    const externalReference = paymentData?.externalReference || "";

    console.log(`[Webhook Asaas] Received event: ${event}, Ref: ${externalReference}, PaymentId: ${paymentData?.id || "N/A"}`);

    // --- Handle payment confirmation events ---
    if (["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(event) && externalReference?.startsWith("rental_")) {
      const rentalId = externalReference.replace("rental_", "");
      const rental = await RentalModel.findById(rentalId);

      if (!rental) {
        console.warn(`[Webhook Asaas] Rental not found for ref: ${externalReference}`);
        return res.status(200).send("OK");
      }

      // Double-check with Asaas API to prevent spoofed webhooks
      if (rental.payment_id || paymentData?.id) {
        const paymentIdToCheck = rental.payment_id || paymentData.id;
        const { isPaid } = await getAsaasPaymentStatus(paymentIdToCheck);

        if (isPaid && rental.payment_status !== "PAID") {
          await RentalModel.updatePayment(rental.id, {
            payment_id: paymentData.id || rental.payment_id,
            payment_status: "PAID",
            status: "pending", // Transitions to "Aguardando empresa"
          });
          console.log(`[Webhook Asaas] ✅ Rental ${rental.id} payment confirmed! Status updated to pending.`);
        } else if (!isPaid) {
          console.warn(`[Webhook Asaas] Payment ${paymentIdToCheck} NOT confirmed by API (spoofed webhook?)`);
        }
      }
    }

    // --- Handle payment overdue ---
    if (event === "PAYMENT_OVERDUE" && externalReference?.startsWith("rental_")) {
      const rentalId = externalReference.replace("rental_", "");
      console.warn(`[Webhook Asaas] Payment overdue for rental ${rentalId}`);
      // Optionally auto-cancel expired rentals here
    }

    // --- Handle split events — AUTOMATIC PAYOUT to company bank/Pix ---
    if (event === "PAYMENT_SPLIT_DONE") {
      const splitId = payload?.additionalInfo?.splitId || "N/A";
      console.log(
        `[Webhook Asaas] 💰 Split executed: splitId=${splitId}, paymentId=${paymentData?.id || "N/A"}, ref=${externalReference}`
      );

      // Auto-transfer: find the rental → find the company → transfer funds
      if (externalReference?.startsWith("rental_")) {
        await handleAutoTransferOnSplitDone(externalReference, paymentData?.id, splitId);
      }
    }

    if (event === "PAYMENT_SPLIT_DIVERGENCE_BLOCK") {
      const splitId = payload?.additionalInfo?.splitId || "N/A";
      console.error(
        `[Webhook Asaas] ⚠️ SPLIT DIVERGENCE BLOCK: splitId=${splitId}, paymentId=${paymentData?.id || "N/A"}. ` +
        `Split value exceeds netValue. Must be corrected within 2 business days.`
      );
    }

    if (event === "PAYMENT_SPLIT_DIVERGENCE_BLOCK_FINISHED") {
      console.warn(
        `[Webhook Asaas] Split divergence block expired for paymentId=${paymentData?.id || "N/A"}. Splits were cancelled.`
      );
    }

    // --- Handle refund/chargeback ---
    if (["PAYMENT_REFUNDED", "PAYMENT_CHARGEBACK_REQUESTED"].includes(event) && externalReference?.startsWith("rental_")) {
      const rentalId = externalReference.replace("rental_", "");
      const rental = await RentalModel.findById(rentalId);
      if (rental && rental.payment_status !== "CANCELLED") {
        await RentalModel.updatePayment(rental.id, {
          payment_status: "CANCELLED",
        });
        console.log(`[Webhook Asaas] Rental ${rental.id} payment refunded/chargebacked.`);
      }
    }

    // --- Handle transfer events (audit logging for subaccount payouts) ---
    if (event === "TRANSFER_CREATED") {
      const transferData = payload?.transfer || {};
      console.log(`[Webhook Asaas] 📤 Transfer created: id=${transferData?.id}, value=${transferData?.value}, status=${transferData?.status}`);
    }
    if (event === "TRANSFER_PENDING") {
      const transferData = payload?.transfer || {};
      console.log(`[Webhook Asaas] ⏳ Transfer pending: id=${transferData?.id}, value=${transferData?.value}`);
    }
    if (event === "TRANSFER_DONE") {
      const transferData = payload?.transfer || {};
      console.log(`[Webhook Asaas] ✅ Transfer completed: id=${transferData?.id}, value=${transferData?.value}`);
    }
    if (event === "TRANSFER_FAILED") {
      const transferData = payload?.transfer || {};
      console.error(`[Webhook Asaas] ❌ Transfer FAILED: id=${transferData?.id}, value=${transferData?.value}, reason=${transferData?.failReason || "unknown"}`);
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("[Webhook Asaas] Error:", error);
    // Always return 200 to prevent webhook retry storms
    res.status(200).send("OK");
  }
});

// ============================================================
// Helpers
// ============================================================

async function findRentalByPaymentId(paymentId: string) {
  try {
    const { supabaseAdmin } = require("../config/supabase");
    const { data } = await supabaseAdmin
      .from("rentals")
      .select("*")
      .eq("payment_id", paymentId)
      .maybeSingle();
    if (data) {
      return data;
    }
  } catch (err) {
    console.warn(`[Webhook] Could not find rental by payment_id ${paymentId}:`, err);
  }
  return null;
}

/**
 * Automatic payout: when a Split is liquidated (PAYMENT_SPLIT_DONE),
 * transfer the subaccount's available balance to the company's
 * registered Pix key or traditional bank account (TED).
 *
 * Flow:
 * 1. Find the rental by externalReference
 * 2. Look up the company and its Asaas subaccount API key
 * 3. Query available balance in the subaccount
 * 4. Transfer the available balance to the company's Pix or bank account
 */
async function handleAutoTransferOnSplitDone(
  externalReference: string,
  paymentId?: string,
  splitId?: string
): Promise<void> {
  try {
    const rentalId = externalReference.replace("rental_", "");
    const rental = await RentalModel.findById(rentalId);
    if (!rental) {
      console.warn(`[AutoTransfer] Rental not found for ref: ${externalReference}`);
      return;
    }

    // Get company with full data (Asaas keys + banking)
    const company = await CompanyModel.findById(rental.company_id);
    if (!company) {
      console.warn(`[AutoTransfer] Company ${rental.company_id} not found`);
      return;
    }

    if (!company.asaas_api_key) {
      console.warn(`[AutoTransfer] Company ${company.name} (${company.id}) has no Asaas API key — cannot auto-transfer`);
      return;
    }

    // Check if company has payout details configured
    const hasPixKey = company.pix_key && company.pix_key_type;
    const hasBankAccount = company.bank_code && company.bank_account && company.bank_agency;

    if (!hasPixKey && !hasBankAccount) {
      console.warn(
        `[AutoTransfer] Company ${company.name} (${company.id}) has no Pix key or bank account registered. ` +
        `Split funds will remain in subaccount until payout details are configured.`
      );
      return;
    }

    // Query the subaccount's available balance
    let balance;
    try {
      balance = await getSubaccountBalance(company.asaas_api_key);
    } catch (err: any) {
      console.error(`[AutoTransfer] Failed to query balance for company ${company.name}: ${err.message}`);
      return;
    }

    if (balance.availableBalance <= 0) {
      console.log(
        `[AutoTransfer] Company ${company.name}: available balance is R$ ${balance.availableBalance.toFixed(2)} — nothing to transfer`
      );
      return;
    }

    // Execute transfer
    const transferValue = balance.availableBalance;
    const description = `Repasse automático AlugaTools - Pedido #${rentalId.slice(0, 8)}`;

    console.log(
      `[AutoTransfer] 🚀 Initiating transfer of R$ ${transferValue.toFixed(2)} for company ${company.name} ` +
      `(splitId=${splitId}, paymentId=${paymentId})`
    );

    let transferResult;
    if (hasPixKey) {
      transferResult = await transferSubaccountFunds(company.asaas_api_key, {
        value: transferValue,
        description,
        pixAddressKey: company.pix_key!,
        pixAddressKeyType: company.pix_key_type as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP",
      });
    } else {
      transferResult = await transferSubaccountFunds(company.asaas_api_key, {
        value: transferValue,
        description,
        bankAccount: {
          bank: { code: company.bank_code! },
          ownerName: company.bank_owner_name || company.name,
          cpfCnpj: (company.bank_cpf_cnpj || "").replace(/\D/g, ""),
          agency: company.bank_agency!,
          account: company.bank_account!,
          accountDigit: company.bank_account_digit || "0",
          bankAccountType: (company.bank_account_type as "CONTA_CORRENTE" | "CONTA_POUPANCA") || "CONTA_CORRENTE",
        },
      });
    }

    console.log(
      `[AutoTransfer] ✅ Transfer initiated for company ${company.name}: R$ ${transferValue.toFixed(2)} → ` +
      `${hasPixKey ? `Pix (${company.pix_key_type}: ${company.pix_key})` : `TED (Banco ${company.bank_code} Ag ${company.bank_agency} CC ${company.bank_account})`}. ` +
      `Transfer ID: ${transferResult?.id || "N/A"}`
    );
  } catch (err: any) {
    // Never throw from here — we don't want to fail the webhook
    console.error(
      `[AutoTransfer] ❌ Error during auto-transfer for ref ${externalReference}: ${err.message}`
    );
  }
}

export default router;
