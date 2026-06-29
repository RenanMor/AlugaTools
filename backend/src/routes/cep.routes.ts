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

    const response = await axios.get(`https://viacep.com.br/ws/${cleanCep}/json/`);

    if (response.data.erro) {
      return res.status(404).json({ error: "CEP não encontrado" });
    }

    // Return mapped fields for easier auto-fill on frontend
    const mappedData = {
      cep: response.data.cep,
      street: response.data.logradouro,
      complement: response.data.complemento,
      neighborhood: response.data.bairro,
      city: response.data.localidade,
      state: response.data.uf,
    };

    res.json({ data: mappedData });
  } catch (err: any) {
    console.error("[CEP Lookup] Error:", err.message);
    res.status(500).json({ error: "Falha ao buscar CEP na API externa" });
  }
});

export default router;
