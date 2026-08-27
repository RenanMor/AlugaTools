# AlugaTools API (Backend)

API backend em **Node.js + Express + TypeScript**, seguindo o padrão **MVC**, para o marketplace de aluguel de ferramentas **AlugaTools**. Utiliza **Supabase** (PostgreSQL + Auth) como banco de dados e autenticação, com sistema de pagamento integrado via **Asaas** (Split de Pagamentos) para distribuição automática de valores entre plataforma e empresas.

## Arquitetura (MVC)

```
backend/
  src/
    config/        Variáveis de ambiente (Asaas, Supabase, etc.)
    controllers/   Lógica de negócio e orquestração de requisições/respostas
    models/        Camada de acesso a dados via @supabase/supabase-js
    routes/        Definições de rotas Express e Webhooks
    middlewares/   Tratamento de erros, rate limiting e verificação de token Supabase
    utils/         Integrações de pagamento (Asaas ativo com Split; Mercado Pago e Pagar.me desativados)
    app.ts         Configuração do Express (Helmet, CORS, rate limit)
    server.ts      Ponto de entrada do servidor
  supabase/
    schema.sql     Schema das tabelas + políticas RLS
```

## Gateway de Pagamento Ativo (Asaas com Split)

- **Gateway Principal Ativo**: **Asaas v3** (com Split de Pagamentos)
- **Formas de pagamento suportadas**:
  - ✅ **PIX**: Geração de QR Code e Chave Copia e Cola (`POST /v3/payments`)
  - ✅ **Cartão de Crédito**: Processamento direto com parcelamento de 1x a 12x (`POST /v3/payments`)
  - ✅ **Cartão de Débito**: Via redirect para checkout Asaas (`invoiceUrl`)
- **Split de Pagamentos**: Distribuição automática entre plataforma e empresa
  - Cada empresa possui uma subconta Asaas com `walletId`
  - Na criação da cobrança, o array `split` define quanto vai para a empresa
  - O saldo restante (comissão da plataforma) permanece na conta principal
  - Taxa padrão: configurável via `PLATFORM_FEE_PERCENT` (default 20%)
- **Gateways Desativados / Inativos**: Mercado Pago e Pagar.me permanecem no código caso precisem ser reativados no futuro.

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz de `backend/` baseado em `env.sample.txt`:

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta do servidor (padrão 4000) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave anônima pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (uso exclusivo no servidor) |
| `ASAAS_API_KEY` | API Key da conta principal Asaas |
| `ASAAS_BASE_URL` | URL base da API Asaas (prod: `https://api.asaas.com/v3`, sandbox: `https://api-sandbox.asaas.com/v3`) |
| `PLATFORM_FEE_PERCENT` | Percentual retido pela plataforma (default: 20) |
| `MERCADO_PAGO_ACCESS_TOKEN` | *(Inativo)* Access Token do Mercado Pago |
| `MERCADO_PAGO_PUBLIC_KEY` | *(Inativo)* Public Key do Mercado Pago |

## Webhooks

| Rota | Descrição |
|------|-----------|
| POST `/api/webhooks/asaas` | Webhook principal — notificações do Asaas (pagamentos, split) |
| POST `/api/webhooks/mercadopago` | *(Inativo)* Webhook do Mercado Pago |
| POST `/api/webhooks/pagarme` | *(Inativo)* Webhook do Pagar.me |

### Eventos Asaas tratados

| Evento | Ação |
|--------|------|
| `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED` | Marca aluguel como "pending" (pago, aguardando empresa) |
| `PAYMENT_SPLIT_DONE` | Log de auditoria — split executado com sucesso |
| `PAYMENT_SPLIT_DIVERGENCE_BLOCK` | Alerta — split excede netValue, 2 dias úteis para corrigir |
| `PAYMENT_OVERDUE` | Log de aviso — pagamento vencido |
| `PAYMENT_REFUNDED` / `PAYMENT_CHARGEBACK_REQUESTED` | Marca pagamento como cancelado |

## Fluxo de Split

```
Cliente paga R$ 100,00 (PIX/Cartão)
         │
         ▼
   Asaas processa o pagamento
         │
         ▼
   Taxas Asaas: R$ 1,99 → netValue = R$ 98,01
         │
         ▼
   Split: empresa recebe 80% do netValue = R$ 78,41
         │
         ▼
   Plataforma retém: R$ 98,01 - R$ 78,41 = R$ 19,60
```

## Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/rentals` | Criar aluguel (status: `awaiting_payment`) |
| POST | `/api/rentals/:id/pay` | Processar pagamento via Asaas (com Split automático) |
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
