import { Router, Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";

const router = Router();

router.post("/signup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, profile } = req.body;

    if (!email || !password || !name || !profile) {
      return res.status(400).json({ error: "E-mail, senha, nome e perfil são obrigatórios" });
    }

    // 1. Create user in Supabase Auth (confirmed immediately using admin key)
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, profile },
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
        companyId,
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
