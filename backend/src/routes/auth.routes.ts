import { Router, Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";

const router = Router();

router.post("/signup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, profile, cpf, phone, role } = req.body;

    if (!email || !password || !name || !profile || !cpf || !phone) {
      return res.status(400).json({ error: "E-mail, senha, nome, perfil, CPF e telefone são obrigatórios" });
    }

    // 1. Create user in Supabase Auth (confirmed immediately using admin key)
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, profile, cpf, phone, role: role || "user" },
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
        cpf,
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
      const { data: companyData, error: companyError } = await supabaseAdmin
        .from("companies")
        .insert({
          owner_id: userData.user.id,
          name: `${name} Locações`,
          logo: "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=200&q=80",
          description: "Locação de ferramentas",
          category_id: "c1",
          location: "São Paulo, SP",
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
    }

    // 1. Sign in with Supabase Auth
    const { data: sessionData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !sessionData.session) {
      return res.status(400).json({ error: "Credenciais inválidas" });
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
    if (dbUser.profile === "company") {
      const { data: companyData } = await supabaseAdmin
        .from("companies")
        .select("id")
        .eq("owner_id", dbUser.id)
        .single();
      
      if (companyData) {
        companyId = companyData.id;
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
        companyId,
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

export default router;
