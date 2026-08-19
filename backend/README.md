# AlugaTools API (Backend)

API backend em **Node.js + Express + TypeScript**, seguindo o padrão **MVC**, para o marketplace de aluguel de ferramentas **AlugaTools**. Utiliza **Supabase** (PostgreSQL + Auth) como banco de dados e autenticação, com sistema de pagamento integrado via **Mercado Pago** (Checkout API / Orders / Preferences).

## Arquitetura (MVC)

```
backend/
  src/
    config/        Variáveis de ambiente (Mercado Pago, Supabase, etc.)
    controllers/   Lógica de negócio e orquestração de requisições/respostas
    models/        Camada de acesso a dados via @supabase/supabase-js
    routes/        Definições de rotas Express e Webhooks
    middlewares/   Tratamento de erros, rate limiting e verificação de token Supabase
    utils/         Integrações de pagamento (Mercado Pago ativo; Pagar.me e Asaas desativados)
    app.ts         Configuração do Express (Helmet, CORS, rate limit)
    server.ts      Ponto de entrada do servidor
  supabase/
    schema.sql     Schema das tabelas + políticas RLS
```

## Gateway de Pagamento Ativo (Mercado Pago)

- **Gateway Principal Ativo**: **Mercado Pago**
- **Formas de pagamento suportadas**:
  - ✅ **PIX**: Geração de QR Code e Chave Copia e Cola instantânea (`POST /v1/payments`).
  - ✅ **Cartão de Crédito**: Tokenização e processamento com parcelamento de 1x a 12x (`POST /v1/payments`).
  - ✅ **Cartão de Débito**: Cobrança direta de débito com 3DS (`POST /v1/payments`).
  - ✅ **Saldo Mercado Pago / Carteira**: Preferência com redirecionamento para pagamento com saldo da conta Mercado Pago (`POST /checkout/preferences`).
- **Gateways Desativados / Inativos**: Pagar.me e Asaas permanecem no código caso precisem ser reativados no futuro.

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz de `backend/` baseado em `env.sample.txt`:

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta do servidor (padrão 4000) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave anônima pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (uso exclusivo no servidor) |
| `MERCADO_PAGO_ACCESS_TOKEN` | Access Token do Mercado Pago (`APP_USR-...` ou `TEST-...`) |
| `MERCADO_PAGO_PUBLIC_KEY` | Public Key do Mercado Pago (`APP_USR-...` ou `TEST-...`) |
| `MERCADO_PAGO_BASE_URL` | URL base do Mercado Pago (`https://api.mercadopago.com`) |

## Webhooks

| Rota | Descrição |
|------|-----------|
| POST `/api/webhooks/mercadopago` | Webhook de notificações do Mercado Pago (validação direta na API) |

## Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/rentals` | Criar aluguel (status: `awaiting_payment`) |
| POST | `/api/rentals/:id/pay` | Processar pagamento via Mercado Pago |
| POST | `/api/rentals/:id/cancel` | Cancelar pedido e restaurar estoque |
| GET | `/api/rentals/me` | Aluguéis do cliente autenticado |
| GET | `/api/rentals/company/:companyId` | Aluguéis recebidos pela empresa |
| PATCH | `/api/rentals/:id/status` | Atualizar status do aluguel |
| PATCH | `/api/rentals/:id/rating` | Avaliar aluguel e recalcular média da empresa |

## Execução

```bash
cd backend
npm install
npm run dev      # desenvolvimento (tsx watch)
npm run build    # compila para dist/
npm start        # produção
```
