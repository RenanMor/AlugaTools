import axios from "axios";
import { env } from "../config/env";

interface ChargeInput {
  amount: number;
  description: string;
  referenceId: string;
}

export async function createPagBankCharge(input: ChargeInput) {
  const payload = {
    reference_id: input.referenceId,
    description: input.description,
    amount: { value: input.amount, currency: "BRL" },
    payment_method: { type: "PIX" },
  };

  const response = await axios.post(`${env.pagBankBaseUrl}/orders`, payload, {
    headers: {
      Authorization: `Bearer ${env.pagBankToken}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
}
