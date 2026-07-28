# 📌 Vulnerabilidades de Segurança Pendentes — AlugaTools

Este documento lista as 3 vulnerabilidades pendentes identificadas durante a auditoria de segurança inicial, com seu contexto, arquivos afetados e plano de ação para quando for solicitada a correção.

---

## 1. Dados de Cartão de Crédito Trafegando pelo Backend (Compliance PCI-DSS)

- **Severidade:** 🟡 Média
- **Arquivos afetados:**
  - `backend/src/controllers/rental.controller.ts`
  - `backend/src/utils/pagbank.ts`
  - `frontend/app/order/[id].tsx` (ou telas de checkout)
- **Problema:** 
  Atualmente, o número completo do cartão, CVV, expiração e nome do titular são enviados em texto plano do frontend para a API Express e depois repassados ao PagBank. Se o backend sofrer interceptação ou vazar logs de memória, dados sensíveis de cartão ficam expostos.
- **Plano de Correção:**
  1. Integrar o SDK Javascript / Web-SDK do PagBank no frontend.
  2. Gerar o `card_token` ou `encrypted_card` diretamente no dispositivo/navegador do cliente.
  3. Alterar o endpoint `POST /api/rentals/:id/pay` para aceitar apenas o `card_token` ao invés dos dados brutos do cartão.

---

## 2. Armazenamento do Token de Sessão em `localStorage` na Web

- **Severidade:** 🔵 Baixa / Média
- **Arquivos afetados:**
  - `frontend/lib/_core/auth.ts`
  - `frontend/lib/_core/api.ts`
- **Problema:** 
  Na versão Web do frontend, o `SESSION_TOKEN_KEY` é gravado no `window.localStorage`. Qualquer script malicioso (via XSS) que consiga rodar no domínio do frontend pode ler `localStorage.getItem()` e roubar o token de sessão.
- **Plano de Correção:**
  1. No login Web (`/api/auth/signin`), o backend deve emitir o token em um cookie de resposta com as flags `HttpOnly`, `Secure` e `SameSite=Lax/Strict`.
  2. Ajustar o frontend web para utilizar autenticação baseada em cookie via `credentials: "include"` em todas as chamadas de API, mantendo `SecureStore` exclusivo para plataformas nativas (iOS/Android).

---

## 3. URLs de Fallback Hardcoded no Frontend & Política CORP Ampla

- **Severidade:** 🔵 Baixa
- **Arquivos afetados:**
  - `frontend/constants/oauth.ts`
  - `frontend/lib/_core/api.ts`
  - `backend/src/app.ts`
- **Problema:** 
  1. O frontend possui fallbacks com URLs hardcoded (`https://alugatools-api.onrender.com`). Caso o domínio venha a expirar ou mudar de infraestrutura, builds antigos continuarão apontando para ele.
  2. No backend (`app.ts`), o Helmet está configurado com `crossOriginResourcePolicy: false` globalmente em vez de ser restrito apenas à rota estática `/uploads`.
- **Plano de Correção:**
  1. Garantir tratamento estrito de variáveis de ambiente no frontend (`EXPO_PUBLIC_API_BASE_URL`) e exigir sua definição nos ambientes de staging/produção.
  2. Ajustar a política CORP do Helmet para aplicar `crossOriginResourcePolicy: { policy: "cross-origin" }` especificamente no middleware da rota `/uploads`.
