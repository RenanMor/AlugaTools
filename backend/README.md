# AlugaTools API (Backend)

API backend em **Node.js + Express + TypeScript**, seguindo o padrão **MVC**, para o marketplace de aluguel de ferramentas **AlugaTools**. Utiliza **Supabase** (PostgreSQL + Auth) como banco de dados e autenticação, com sistema inteligente de pagamento **Dual-Gateway (Pagar.me + Asaas)**.

## Arquitetura (MVC)

```
backend/
  src/
    config/        Variáveis de ambiente (Pagar.me, Asaas, Supabase)
    controllers/   Lógica de negócio e orquestração de requisições/respostas
    models/        Camada de acesso a dados via @supabase/supabase-js
    routes/        Definições de rotas Express e Webhooks
    middlewares/   Tratamento de erros, rate limiting e verificação de token Supabase
    utils/         Integrações de pagamento (Pagar.me V5, Asaas v3, Payment Gateway Router)
    app.ts         Configuração do Express (Helmet, CORS, rate limit)
    server.ts      Ponto de entrada do servidor
  supabase/
    schema.sql     Schema das tabelas + políticas RLS
```

## Roteamento de Pagamento (Dual-Gateway)

- **Pagar.me API V5**: Utilizado para compras com valor total **até R$ 200,00** (ou qualquer cartão de débito).
- **Asaas API v3**: Utilizado para compras com valor total **acima de R$ 200,00**.
- **Formas de pagamento**: PIX, Cartão de Crédito e Cartão de Débito.

## Segurança

A API aplica **Helmet** para cabeçalhos HTTP seguros, **Rate Limiting** por IP e **verificação de token Supabase** em rotas protegidas. As chaves secretas do **Pagar.me**, **Asaas** e a `SERVICE_ROLE_KEY` são manipuladas exclusivamente no servidor, nunca no app frontend.

## Configuração

Crie um arquivo `.env` na raiz de `backend/` baseado em `env.sample.txt`:

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta do servidor (padrão 4000) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave anônima pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (uso exclusivo no servidor) |
| `PAGARME_SECRET_KEY` | Chave secreta Pagar.me (`sk_live_...` ou `sk_test_...`) |
| `PAGARME_BASE_URL` | URL base Pagar.me (`https://api.pagar.me/core/v5`) |
| `ASAAS_API_KEY` | Access Token API do Asaas |
| `ASAAS_BASE_URL` | URL base Asaas (`https://api.asaas.com/v3` ou sandbox) |
| `PAYMENT_GATEWAY_THRESHOLD` | Threshold em R$ para roteamento (padrão 200) |

## Webhooks

| Rota | Descrição |
|------|-----------|
| POST `/api/webhooks/pagarme` | Webhook de eventos Pagar.me (validação direta na API) |
| POST `/api/webhooks/asaas` | Webhook de eventos Asaas (validação direta na API) |

## Banco de Dados (Supabase)

Execute o conteúdo de `supabase/schema.sql` no editor SQL do Supabase. Para rastreamento de gateway, certifique-se de que a coluna `payment_gateway` está presente na tabela `rentals`:

```sql
ALTER TABLE rentals ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT NULL;
```

## Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/rentals` | Criar aluguel (status: `awaiting_payment`) |
| POST | `/api/rentals/:id/pay` | Processar pagamento via Gateway inteligente |
| POST | `/api/rentals/:id/cancel` | Cancelar pedido e restaurar estoque |
| GET | `/api/rentals/me` | Aluguéis do cliente autenticado |
| GET | `/api/rentals/company/:companyId` | Aluguéis recebidos pela empresa |
| PATCH | `/api/rentals/:id/status` | Atualizar status do aluguel (com máquina de estados) |
| PATCH | `/api/rentals/:id/rating` | Avaliar aluguel e recalcular média da empresa |

## Execução

```bash
cd backend
npm install
npm run dev      # desenvolvimento (tsx watch)
npm run build    # compila para dist/
npm start        # produção
```
