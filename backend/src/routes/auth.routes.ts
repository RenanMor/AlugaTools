import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { supabaseAdmin } from "../config/supabase";
import { verifySupabaseToken } from "../middlewares/auth.middleware";

const router = Router();

router.post("/signup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      email, password, name, profile, cpf, cnpj, phone, state, city,
      // Address fields (company)
      postal_code, address_street, address_number, neighborhood,
      // Payment method (company)
      pix_key_type, pix_key,
      bank_code, bank_agency, bank_account, bank_account_digit, bank_account_type,
      bank_owner_name, bank_cpf_cnpj,
    } = req.body;

    if (profile === "company") {
      if (!email || !password || !name || !cnpj || !phone) {
        return res.status(400).json({ error: "E-mail, senha, nome da empresa, CNPJ e telefone são obrigatórios para empresas" });
      }
    } else {
      if (!email || !password || !name || !cpf || !phone) {
        return res.status(400).json({ error: "E-mail, senha, nome completo, CPF e telefone são obrigatórios para clientes" });
      }
    }

    // SECURITY FIX (MED-01): Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Formato de e-mail inválido" });
    }

    // SECURITY FIX (MED-01): Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: "A senha deve ter pelo menos 8 caracteres" });
    }

    // SECURITY FIX (MED-01): Sanitize name — strip HTML tags to prevent stored XSS
    const sanitizedName = name.replace(/<[^>]*>/g, "").trim();
    if (!sanitizedName || sanitizedName.length < 2) {
      return res.status(400).json({ error: "Nome deve ter pelo menos 2 caracteres" });
    }
    if (sanitizedName.length > 100) {
      return res.status(400).json({ error: "Nome não pode ter mais de 100 caracteres" });
    }

    // SECURITY FIX (MED-01): Validate CPF/CNPJ format
    if (cpf) {
      const cleanCpf = cpf.replace(/\D/g, "");
      if (cleanCpf.length !== 11) {
        return res.status(400).json({ error: "CPF deve ter 11 dígitos" });
      }
    }
    if (cnpj) {
      const cleanCnpj = cnpj.replace(/\D/g, "");
      if (cleanCnpj.length !== 14) {
        return res.status(400).json({ error: "CNPJ deve ter 14 dígitos" });
      }
    }

    // 1. Create user in Supabase Auth (confirmed immediately using admin key)
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: sanitizedName, profile, cpf: cpf || null, cnpj: cnpj || null, phone, role: "user" },
    });

    if (authError || !userData.user) {
      return res.status(400).json({ error: authError?.message || "Erro ao criar usuário" });
    }

    // 2. Create user in public.users table
    const { error: dbError } = await supabaseAdmin
      .from("users")
      .insert({
        id: userData.user.id,
        name: sanitizedName,
        email,
        profile,
        cpf: cpf ? cpf.replace(/\D/g, "") : null,
        cnpj: cnpj ? cnpj.replace(/\D/g, "") : null,
        phone,
        role: "user",
      });

    if (dbError) {
      // Cleanup auth user on failure
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
      return res.status(400).json({ error: dbError.message });
    }

    // 3. Create default company if profile is 'company'
    let companyId: string | undefined;
    if (profile === "company") {
      const rawCompName = req.body.companyName || name;
      const cleanName = rawCompName.replace(/^ \s+/i, "").replace(/\s+ $/i, "");

      // Validate Pix key via Asaas DICT if provided during signup
      let resolvedOwnerName = bank_owner_name || null;
      let resolvedCpfCnpj = bank_cpf_cnpj || null;
      if (pix_key && pix_key_type) {
        try {
          const { validateAsaasPixKey } = await import("../utils/asaas");
          const pixResult = await validateAsaasPixKey(pix_key_type, pix_key);
          if (!pixResult.valid) {
            // Cleanup auth user on invalid Pix
            await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
            return res.status(400).json({
              error: `Chave Pix inválida: ${pixResult.errorMessage || "Não encontrada no Banco Central"}`,
            });
          }
          // Use holder name/doc from DICT if not manually provided
          if (!resolvedOwnerName && pixResult.name) resolvedOwnerName = pixResult.name;
          if (!resolvedCpfCnpj && pixResult.cpfCnpj) resolvedCpfCnpj = pixResult.cpfCnpj;
          console.log(`[Signup] ✅ Pix validated for new company: ${pix_key_type} ${pix_key} → ${pixResult.name}`);
        } catch (pixErr: any) {
          // Don't block signup if Asaas is unreachable (sandbox may be off)
          console.warn(`[Signup] Pix validation skipped (Asaas unavailable):`, pixErr.message);
        }
      }

      const companyInsert: any = {
        owner_id: userData.user.id,
        name: cleanName,
        logo: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=200&q=80",
        description: " ",
        category_id: "c1",
        location: `${city || "São Paulo"}, ${state || "SP"}`,
        state: state || "SP",
        city: city || "São Paulo",
        cnpj: cnpj ? cnpj.replace(/\D/g, "") : null,
        phone: phone || null,
        // Address
        postal_code: postal_code || null,
        address_street: address_street || null,
        address_number: address_number || null,
        neighborhood: neighborhood || null,
        // Payment method
        pix_key_type: pix_key_type || null,
        pix_key: pix_key || null,
        bank_code: bank_code || null,
        bank_agency: bank_agency || null,
        bank_account: bank_account || null,
        bank_account_digit: bank_account_digit || null,
        bank_account_type: bank_account_type || null,
        bank_owner_name: resolvedOwnerName,
        bank_cpf_cnpj: resolvedCpfCnpj,
      };

      const { data: companyData, error: companyError } = await supabaseAdmin
        .from("companies")
        .insert(companyInsert)
        .select()
        .single();

      if (companyError) {
        console.error("Erro ao criar empresa padrão:", companyError);
      } else {
        companyId = companyData.id;
      }
    }

    // 4. Sign in to get access token
    const { data: sessionData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !sessionData.session) {
      return res.status(200).json({
        message: "Usuário criado com sucesso. Por favor, faça login.",
        user: {
          id: userData.user.id,
          name,
          email,
          profile,
          role: "user",
          companyId,
        }
      });
    }

    res.status(201).json({
      token: sessionData.session.access_token,
      user: {
        id: userData.user.id,
        name,
        email,
        profile,
        role: "user",
        companyId,
      }
    });
  } catch (err) {
    next(err);
  }
});

// SECURITY FIX (HIGH-01b): Dedicated rate limiter for signin to prevent brute-force
const signinLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 5, // max 5 signin attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente em 1 minuto." },
});

router.post("/signin", signinLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, cpf, cnpj, password, profile } = req.body;
    // Sensitive payload logging removed for security

    if (!password) {
      return res.status(400).json({ error: "Senha é obrigatória" });
    }

    let targetEmail = email;

    if (cpf || cnpj) {
      const cleanDoc = (cpf || cnpj)!.replace(/\D/g, "");
      // Document search logging removed for security

      // Query direta pelo campo — evita varredura total da tabela (sujeita a RLS)
      let dbUser: { email: string; profile: string } | null = null;

      if (cpf) {
        const { data, error } = await supabaseAdmin
          .from("users")
          .select("email, profile")
          .eq("cpf", cleanDoc)
          .maybeSingle();
        if (error) console.error("[Auth] CPF query error:", error);
        dbUser = data;
      }

      if (!dbUser && cnpj) {
        const { data, error } = await supabaseAdmin
          .from("users")
          .select("email, profile")
          .eq("cnpj", cleanDoc)
          .maybeSingle();
        if (error) console.error("[Auth] CNPJ query error:", error);
        dbUser = data;
      }

      // Search result logging removed for security

      if (!dbUser) {
        // SECURITY FIX (HIGH-01): Use generic message to prevent CPF/CNPJ enumeration.
        // Do NOT reveal whether the document exists or not.
        return res.status(401).json({
          error: "Credenciais inválidas. Verifique seus dados e tente novamente."
        });
      }

      targetEmail = dbUser.email;
    } else if (email) {
      const { data: dbUser } = await supabaseAdmin
        .from("users")
        .select("profile")
        .eq("email", email)
        .single();
    } else {
      return res.status(400).json({ error: "CPF, CNPJ ou E-mail é obrigatório" });
    }

    // 1. Sign in with Supabase Auth
    const { data: sessionData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: targetEmail,
      password,
    });

    if (authError || !sessionData.session) {
      // SECURITY FIX (HIGH-01): Same generic message as document-not-found
      return res.status(401).json({ error: "Credenciais inválidas. Verifique seus dados e tente novamente." });
    }

    // 2. Fetch public user profile
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", sessionData.user.id)
      .single();

    if (dbError || !dbUser) {
      return res.status(404).json({ error: "Perfil de usuário não encontrado no banco de dados" });
    }

    // 3. Fetch company ID if company profile
    let companyId: string | undefined;
    let companyStatus: string | undefined;
    let delivererCompanyId: string | undefined;
    const isBrandProfile = dbUser.profile === "company" || dbUser.profile === "deliverer";
    let primaryColor = isBrandProfile ? dbUser.primary_color : null;
    let secondaryColor = isBrandProfile ? dbUser.secondary_color : null;

    if (dbUser.profile === "company") {
      const { data: companyData } = await supabaseAdmin
        .from("companies")
        .select("id, status, primary_color, secondary_color")
        .eq("owner_id", dbUser.id)
        .single();

      if (companyData) {
        companyId = companyData.id;
        companyStatus = companyData.status;
        primaryColor = companyData.primary_color || primaryColor;
        secondaryColor = companyData.secondary_color || secondaryColor;
      } else {
        // Self-healing: create the missing company record!
        const cleanCompName = dbUser.name.replace(/^ \s+/i, "").replace(/\s+ $/i, "");
        const { data: newCompany } = await supabaseAdmin
          .from("companies")
          .insert({
            owner_id: dbUser.id,
            name: cleanCompName,
            logo: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=200&q=80",
            description: " ",
            category_id: "c1",
            location: "São Paulo, SP",
            state: "SP",
            city: "São Paulo",
          })
          .select()
          .single();
        if (newCompany) {
          companyId = newCompany.id;
          companyStatus = newCompany.status;
        }
      }
    } else if (dbUser.profile === "deliverer") {
      const { data: delivererData } = await supabaseAdmin
        .from("deliverers")
        .select("company_id")
        .eq("user_id", dbUser.id)
        .maybeSingle();
      if (delivererData) {
        delivererCompanyId = delivererData.company_id;
        const { data: comp } = await supabaseAdmin
          .from("companies")
          .select("primary_color, secondary_color")
          .eq("id", delivererCompanyId)
          .single();
        if (comp) {
          primaryColor = comp.primary_color || primaryColor;
          secondaryColor = comp.secondary_color || secondaryColor;
        }
      }
    }

    res.json({
      token: sessionData.session.access_token,
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        profile: dbUser.profile,
        role: dbUser.role || "user",
        isOwner: dbUser.is_owner || false,
        companyId,
        companyStatus,
        delivererCompanyId,
        avatarUrl: dbUser.avatar_url,
        primaryColor,
        secondaryColor,
      }
    });
  } catch (err) {
    next(err);
  }
});

function backendValidateCPF(cpf: string): boolean {
  cpf = cpf.replace(/[^\d]+/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  let remainder;

  for (let i = 1; i <= 9; i++) {
    sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(9, 10))) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;

  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.substring(10, 11))) return false;

  return true;
}

const firstNames = ["Renan", "Ana", "Carlos", "Maria", "João", "Juliana", "Marcos", "Patrícia", "Lucas", "Sandra"];
const lastNames = ["Morais", "Silva", "Santos", "Souza", "Oliveira", "Pereira", "Lima", "Costa", "Rodrigues", "Almeida"];

// Rate limiter specific to CPF lookup to prevent brute-force enumeration
const cpfLookupLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 10, // max 10 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas consultas de CPF. Tente novamente em 1 minuto." },
});

router.get("/cpf-lookup/:cpf", verifySupabaseToken, cpfLookupLimiter, async (req: Request, res: Response) => {
  const { cpf } = req.params;
  const cleanCpf = cpf.replace(/\D/g, "");

  if (!backendValidateCPF(cleanCpf)) {
    return res.status(400).json({ error: "CPF inválido" });
  }

  const sum = cleanCpf.split("").reduce((acc, digit) => acc + parseInt(digit, 10), 0);
  const firstName = firstNames[sum % firstNames.length];
  const lastName = lastNames[(sum * 7) % lastNames.length];
  const name = `${firstName} ${lastName}`;

  res.json({ name });
});

router.get("/me", verifySupabaseToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (dbError || !dbUser) {
      return res.status(404).json({ error: "Perfil de usuário não encontrado" });
    }

    let companyId: string | undefined;
    let companyStatus: string | undefined;
    let delivererCompanyId: string | undefined;
    const isBrandProfile = dbUser.profile === "company" || dbUser.profile === "deliverer";
    let primaryColor = isBrandProfile ? dbUser.primary_color : null;
    let secondaryColor = isBrandProfile ? dbUser.secondary_color : null;

    if (dbUser.profile === "company") {
      const { data: companyData } = await supabaseAdmin
        .from("companies")
        .select("id, status, primary_color, secondary_color")
        .eq("owner_id", dbUser.id)
        .single();

      if (companyData) {
        companyId = companyData.id;
        companyStatus = companyData.status;
        primaryColor = companyData.primary_color || primaryColor;
        secondaryColor = companyData.secondary_color || secondaryColor;
      } else {
        // Self-healing: create the missing company record!
        const cleanCompName = dbUser.name.replace(/^ \s+/i, "").replace(/\s+ $/i, "");
        const { data: newCompany } = await supabaseAdmin
          .from("companies")
          .insert({
            owner_id: dbUser.id,
            name: cleanCompName,
            logo: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=200&q=80",
            description: " ",
            category_id: "c1",
            location: "São Paulo, SP",
            state: "SP",
            city: "São Paulo",
          })
          .select()
          .single();
        if (newCompany) {
          companyId = newCompany.id;
          companyStatus = newCompany.status;
        }
      }
    } else if (dbUser.profile === "deliverer") {
      const { data: delivererData } = await supabaseAdmin
        .from("deliverers")
        .select("company_id")
        .eq("user_id", dbUser.id)
        .maybeSingle();
      if (delivererData) {
        delivererCompanyId = delivererData.company_id;
        const { data: comp } = await supabaseAdmin
          .from("companies")
          .select("primary_color, secondary_color")
          .eq("id", delivererCompanyId)
          .single();
        if (comp) {
          primaryColor = comp.primary_color || primaryColor;
          secondaryColor = comp.secondary_color || secondaryColor;
        }
      }
    }

    res.json({
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        profile: dbUser.profile,
        role: dbUser.role || "user",
        isOwner: dbUser.is_owner || false,
        companyId,
        companyStatus,
        delivererCompanyId,
        avatarUrl: dbUser.avatar_url,
        primaryColor,
        secondaryColor,
      }
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/avatar", verifySupabaseToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const { avatarUrl, primaryColor, secondaryColor } = req.body;

    const { data: existingUser } = await supabaseAdmin
      .from("users")
      .select("profile")
      .eq("id", userId)
      .single();

    if (existingUser?.profile === "customer") {
      return res.status(403).json({ error: "Clientes não podem alterar a foto de perfil" });
    }

    const userUpdates: any = { avatar_url: avatarUrl };
    if (primaryColor !== undefined) userUpdates.primary_color = primaryColor;
    if (secondaryColor !== undefined) userUpdates.secondary_color = secondaryColor;

    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from("users")
      .update(userUpdates)
      .eq("id", userId)
      .select()
      .single();

    if (dbError) {
      return res.status(400).json({ error: dbError.message });
    }

    let companyId: string | undefined;
    let companyStatus: string | undefined;

    if (dbUser.profile === "company") {
      const companyUpdates: any = { logo: avatarUrl };
      if (primaryColor !== undefined) companyUpdates.primary_color = primaryColor;
      if (secondaryColor !== undefined) companyUpdates.secondary_color = secondaryColor;

      const { data: updatedCompany } = await supabaseAdmin
        .from("companies")
        .update(companyUpdates)
        .eq("owner_id", userId)
        .select("id, status, primary_color, secondary_color")
        .maybeSingle();

      if (updatedCompany) {
        companyId = updatedCompany.id;
        companyStatus = updatedCompany.status;
      }
    }

    res.json({
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        profile: dbUser.profile,
        role: dbUser.role || "user",
        isOwner: dbUser.is_owner || false,
        companyId,
        companyStatus,
        avatarUrl: dbUser.avatar_url,
        primaryColor: dbUser.primary_color,
        secondaryColor: dbUser.secondary_color,
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/user/addresses
router.get("/user/addresses", verifySupabaseToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId as string;
    const { data: dbUser, error } = await supabaseAdmin
      .from("users")
      .select("addresses")
      .eq("id", userId)
      .maybeSingle();

    if (error) return res.status(400).json({ error: error.message });
    const addresses = (dbUser && Array.isArray(dbUser.addresses)) ? dbUser.addresses : [];
    res.json({ data: addresses });
  } catch (err) {
    next(err);
  }
});

// PUT /api/auth/user/addresses
router.put("/user/addresses", verifySupabaseToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId as string;
    const { addresses } = req.body;
    if (!Array.isArray(addresses)) {
      return res.status(400).json({ error: "O campo 'addresses' deve ser um array." });
    }

    const { error } = await supabaseAdmin
      .from("users")
      .update({ addresses })
      .eq("id", userId);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ data: addresses });
  } catch (err) {
    next(err);
  }
});

export default router;
