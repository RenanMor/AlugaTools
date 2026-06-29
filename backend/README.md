# AlugaTools API (Backend)

API backend em **Node.js + Express + TypeScript**, seguindo o padrão **MVC**, para o marketplace de aluguel de ferramentas **AlugaTools**. Utiliza **Supabase** (PostgreSQL + Auth) como banco de dados e autenticação, com integração de pagamentos via **PagBank**.

## Arquitetura (MVC)

```
backend/
  src/
    config/        Variáveis de ambiente e inicialização do cliente Supabase
    controllers/   Lógica de negócio, tratando requisições/respostas
    models/        Camada de acesso a dados via @supabase/supabase-js
    routes/        Definições de rotas Express separadas por entidade
    middlewares/   Tratamento de erros, rate limiting e verificação de token Supabase
    utils/         Helpers (integração PagBank)
    app.ts         Configuração do Express (Helmet, CORS, rate limit)
    server.ts      Ponto de entrada do servidor
  supabase/
    schema.sql     Schema das tabelas + políticas RLS
```

## Segurança

A API aplica **Helmet** para cabeçalhos HTTP seguros, **Rate Limiting** por IP e **verificação de token Supabase** em rotas protegidas. As chaves secretas do **PagBank** e a `SERVICE_ROLE_KEY` são manipuladas exclusivamente no servidor, nunca no app mobile. O acesso ao banco é protegido por **Row Level Security (RLS)**.

## Configuração

Crie um arquivo `.env` na raiz de `backend/` baseado em `env.sample.txt`:

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta do servidor (padrão 4000) |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave anônima pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço (uso exclusivo no servidor) |
| `PAGBANK_TOKEN` | Token de autenticação PagBank |
| `PAGBANK_BASE_URL` | URL base da API PagBank |

## Banco de Dados (Supabase)

Execute o conteúdo de `supabase/schema.sql` no editor SQL do Supabase. Ele cria as tabelas `users`, `companies`, `tools` e `rentals`, habilita RLS e define as políticas de acesso por perfil (Cliente/Empresa).

## Endpoints principais

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/companies/featured` | Empresas em destaque (ordenadas por avaliação) |
| GET | `/api/companies/:id` | Detalhe de uma empresa |
| GET | `/api/companies/category/:categoryId` | Empresas por categoria |
| GET | `/api/tools/company/:companyId` | Ferramentas de uma empresa |
| POST | `/api/tools` | Criar ferramenta (protegido) |
| PUT | `/api/tools/:id` | Editar ferramenta (protegido) |
| DELETE | `/api/tools/:id` | Excluir ferramenta (protegido) |
| POST | `/api/rentals` | Criar aluguel + cobrança PagBank (protegido) |
| GET | `/api/rentals/me` | Aluguéis do cliente autenticado |
| GET | `/api/rentals/company/:companyId` | Aluguéis recebidos pela empresa |
| PATCH | `/api/rentals/:id/status` | Atualizar status do aluguel |
| PATCH | `/api/rentals/:id/rating` | Avaliar aluguel e recalcular média da empresa |

## Fluxo MVC de exemplo (Empresas em destaque)

A rota `GET /api/companies/featured` (em `routes/company.routes.ts`) aciona `CompanyController.getFeatured` (`controllers/company.controller.ts`), que chama `CompanyModel.findFeatured` (`models/company.model.ts`). O Model usa o cliente `@supabase/supabase-js` para consultar a tabela `companies` ordenada por `rating`, retornando os dados para o Controller responder em JSON.

## Execução

```bash
cd backend
npm install
npm run dev      # desenvolvimento (tsx watch)
npm run build    # compila para dist/
npm start        # produção
```
