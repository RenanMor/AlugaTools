import { Router, Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";
import { verifySupabaseToken } from "../middlewares/auth.middleware";

const router = Router();

router.post("/signup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, profile, cpf, cnpj, phone, role, state, city } = req.body;

    if (profile === "company") {
      if (!email || !password || !name || !cnpj || !phone) {
        return res.status(400).json({ error: "E-mail, senha, nome da empresa, CNPJ e telefone são obrigatórios para empresas" });
      }
    } else {
      if (!email || !password || !name || !cpf || !phone) {
        return res.status(400).json({ error: "E-mail, senha, nome completo, CPF e telefone são obrigatórios para clientes" });
      }
    }

    // 1. Create user in Supabase Auth (confirmed immediately using admin key)
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, profile, cpf: cpf || null, cnpj: cnpj || null, phone, role: role || "user" },
    });

    if (authError || !userData.user) {
      return res.status(400).json({ error: authError?.message || "Erro ao criar usuário" });
    }

    // 2. Create user in public.users table
    const { error: dbError } = await supabaseAdmin
      .from("users")
      .insert({
        id: userData.user.id,
        name,
        email,
        profile,
        cpf: cpf ? cpf.replace(/\D/g, "") : null,
        cnpj: cnpj ? cnpj.replace(/\D/g, "") : null,
        phone,
        password,
        role: role || "user",
      });

    if (dbError) {
      // Cleanup auth user on failure
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
      return res.status(400).json({ error: dbError.message });
    }

    // 3. Create default company if profile is 'company'
    let companyId: string | undefined;
    if (profile === "company") {
      const cleanName = name.replace(/^Locações\s+/i, "").replace(/\s+Locações$/i, "");
      const { data: companyData, error: companyError } = await supabaseAdmin
        .from("companies")
        .insert({
          owner_id: userData.user.id,
          name: cleanName,
          logo: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=200&q=80",
          description: "Locações de ferramentas e serviços",
          category_id: "c1",
          location: `${city || "São Paulo"}, ${state || "SP"}`,
          state: state || "SP",
          city: city || "São Paulo",
        })
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
          role: role || "user",
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
        role: role || "user",
        companyId,
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post("/signin", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, cpf, cnpj, password, profile } = req.body;
    console.log("[Backend Auth] Incoming signin payload:", { email, cpf, cnpj, profile });

    if (!password) {
      return res.status(400).json({ error: "Senha é obrigatória" });
    }

    let targetEmail = email;

    if (cpf || cnpj) {
      const cleanDoc = (cpf || cnpj)!.replace(/\D/g, "");
      console.log("[Auth] Searching for document:", cleanDoc);

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

      console.log("[Auth] Search result:", dbUser);

      if (!dbUser) {
        return res.status(401).json({ 
          error: "Documento não encontrado. Verifique o CPF/CNPJ digitado." 
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
      return res.status(401).json({ error: "Senha incorreta ou credenciais inválidas" });
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
        const cleanCompName = dbUser.name.replace(/^Locações\s+/i, "").replace(/\s+Locações$/i, "");
        const { data: newCompany } = await supabaseAdmin
          .from("companies")
          .insert({
            owner_id: dbUser.id,
            name: cleanCompName,
            logo: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=200&q=80",
            description: "Locações de ferramentas e serviços",
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

router.get("/cpf-lookup/:cpf", async (req: Request, res: Response) => {
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
        const cleanCompName = dbUser.name.replace(/^Locações\s+/i, "").replace(/\s+Locações$/i, "");
        const { data: newCompany } = await supabaseAdmin
          .from("companies")
          .insert({
            owner_id: dbUser.id,
            name: cleanCompName,
            logo: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=200&q=80",
            description: "Locações de ferramentas e serviços",
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

    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from("users")
      .update({
        avatar_url: avatarUrl,
        primary_color: primaryColor || null,
        secondary_color: secondaryColor || null
      })
      .eq("id", userId)
      .select()
      .single();

    if (dbError) {
      return res.status(400).json({ error: dbError.message });
    }

    if (dbUser.profile === "company") {
      await supabaseAdmin
        .from("companies")
        .update({
          logo: avatarUrl,
          primary_color: primaryColor || null,
          secondary_color: secondaryColor || null
        })
        .eq("owner_id", userId);
    }

    res.json({
      user: {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        profile: dbUser.profile,
        role: dbUser.role || "user",
        avatarUrl: dbUser.avatar_url,
        primaryColor: dbUser.primary_color,
        secondaryColor: dbUser.secondary_color,
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
