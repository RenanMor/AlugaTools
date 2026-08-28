import { Router } from "express";
import axios from "axios";

const router = Router();

router.get("/:cep", async (req, res, next) => {
  try {
    const { cep } = req.params;
    const cleanCep = cep.replace(/\D/g, "");

    if (cleanCep.length !== 8) {
      return res.status(400).json({ error: "CEP inválido. Deve conter exatamente 8 dígitos." });
    }

    let addressInfo: any = null;

    // 1. Try ViaCEP
    try {
      const response = await axios.get(`https://viacep.com.br/ws/${cleanCep}/json/`, { timeout: 3000 });
      if (!response.data.erro && response.data.localidade) {
        addressInfo = {
          cep: response.data.cep || cleanCep,
          street: response.data.logradouro || "",
          logradouro: response.data.logradouro || "",
          complement: response.data.complemento || "",
          neighborhood: response.data.bairro || "",
          bairro: response.data.bairro || "",
          city: response.data.localidade || "",
          localidade: response.data.localidade || "",
          state: response.data.uf || "",
          uf: response.data.uf || "",
        };
      }
    } catch {
      // Fallback to BrasilAPI below
    }

    // 2. Fallback: BrasilAPI
    if (!addressInfo) {
      try {
        const response = await axios.get(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`, { timeout: 3000 });
        if (response.data && response.data.city) {
          addressInfo = {
            cep: response.data.cep || cleanCep,
            street: response.data.street || "",
            logradouro: response.data.street || "",
            complement: "",
            neighborhood: response.data.neighborhood || "",
            bairro: response.data.neighborhood || "",
            city: response.data.city || "",
            localidade: response.data.city || "",
            state: response.data.state || "",
            uf: response.data.state || "",
          };
        }
      } catch {
        // Silent
      }
    }

    if (!addressInfo) {
      return res.status(404).json({ error: "CEP não encontrado" });
    }

    res.json({ data: addressInfo });
  } catch (err: any) {
    console.error("[CEP Lookup] Error:", err.message);
    res.status(500).json({ error: "Falha ao buscar CEP na API externa" });
  }
});

export default router;
