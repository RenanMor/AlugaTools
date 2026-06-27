# RentTools - Design da Interface Mobile

## Conceito
Marketplace estilo iFood para aluguel de ferramentas. Empresas listam ferramentas; clientes navegam, adicionam ao carrinho e alugam. Autenticação lazy (login só no checkout).

## Paleta de Cores (marca)
- Primary: `#F97316` (laranja vibrante — energia/construção)
- Primary Dark: `#EA580C`
- Background light: `#FFFFFF`, dark: `#0F1115`
- Surface light: `#F8FAFC`, dark: `#1A1D23`
- Foreground light: `#1E293B`, dark: `#F1F5F9`
- Muted: `#64748B`
- Success: `#22C55E` | Warning: `#F59E0B` | Error: `#EF4444`
- Star/Rating: `#FBBF24`

## Lista de Telas
1. **Home (Cliente)** — barra de busca no topo, scroll horizontal de Categorias, lista vertical de "Empresas em Destaque" (logo, nome, estrelas).
2. **Detalhe da Empresa** — header com logo/nome/rating, lista de ferramentas da empresa, botão "Alugar".
3. **Detalhe da Ferramenta** — imagem, descrição, preço/dia, botão "Adicionar ao carrinho".
4. **Busca** — input + resultados filtrados.
5. **Carrinho** — itens adicionados, total, botão "Checkout" (dispara auth lazy).
6. **Auth (Login/Registro)** — modal/sheet, integra Supabase Auth, escolha perfil Cliente/Empresa.
7. **Pedidos (Cliente)** — lista de aluguéis com status (pendente/aceito/ativo/concluído), avaliar após concluído.
8. **Dashboard Empresa** — gerenciar ferramentas (add/editar/excluir), aceitar/recusar pedidos, serviços ativos.
9. **Perfil** — dados do usuário, alternar tema, logout.

## Navegação (Bottom Tabs)
- Início (house.fill)
- Busca (magnifyingglass)
- Carrinho (cart.fill)
- Pedidos (list.bullet)
- Perfil (person.fill)
Dashboard Empresa substitui aba Carrinho/Pedidos quando perfil = Empresa.

## Fluxos Principais
- **Navegar → Alugar (lazy auth)**: Home → Empresa → Ferramenta → Adicionar ao carrinho → Carrinho → Checkout → (se não logado) Auth Sheet → confirma aluguel → Pedidos.
- **Avaliação**: Pedidos → pedido concluído → avaliar 1-5 estrelas → atualiza média da empresa.
- **Empresa**: Login como empresa → Dashboard → adicionar/editar ferramenta → receber pedido → aceitar/recusar → acompanhar ativo.

## Estado / Dados
- Estado local com Context + AsyncStorage para carrinho e sessão.
- Tipos compartilhados: User, Company, Tool, Rental, Rating.
