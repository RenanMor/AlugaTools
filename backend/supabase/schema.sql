create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  profile text not null check (profile in ('customer', 'company')),
  cpf text unique,
  cnpj text unique,
  phone text not null,
  password text not null,
  role text not null default 'user' check (role in ('user', 'admin', 'owner')),
  created_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  logo text,
  description text,
  category_id text,
  location text,
  rating numeric(2,1) not null default 0,
  rating_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  category_id text,
  image text,
  price_per_day numeric(10,2) not null default 0,
  available boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.users (id) on delete cascade,
  days integer not null default 1,
  total_price numeric(10,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','rejected','active','completed')),
  rating integer check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.companies enable row level security;
alter table public.tools enable row level security;
alter table public.rentals enable row level security;

create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_insert_self" on public.users
  for insert with check (true);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

create policy "companies_public_read" on public.companies
  for select using (true);

create policy "companies_owner_insert" on public.companies
  for insert with check (auth.uid() = owner_id);

create policy "companies_owner_update" on public.companies
  for update using (auth.uid() = owner_id);

create policy "companies_owner_delete" on public.companies
  for delete using (auth.uid() = owner_id);

create policy "tools_public_read" on public.tools
  for select using (true);

create policy "tools_owner_write" on public.tools
  for all using (
    exists (
      select 1 from public.companies c
      where c.id = tools.company_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.companies c
      where c.id = tools.company_id and c.owner_id = auth.uid()
    )
  );

create policy "rentals_customer_read" on public.rentals
  for select using (auth.uid() = customer_id);

create policy "rentals_company_read" on public.rentals
  for select using (
    exists (
      select 1 from public.companies c
      where c.id = rentals.company_id and c.owner_id = auth.uid()
    )
  );

create policy "rentals_customer_insert" on public.rentals
  for insert with check (auth.uid() = customer_id);

create policy "rentals_customer_update" on public.rentals
  for update using (auth.uid() = customer_id);

create policy "rentals_company_update" on public.rentals
  for update using (
    exists (
      select 1 from public.companies c
      where c.id = rentals.company_id and c.owner_id = auth.uid()
    )
  );
