create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  profile text not null check (profile in ('customer', 'company', 'deliverer')),
  cpf text unique,
  cnpj text unique,
  phone text not null,
  password text not null,
  role text not null default 'user' check (role in ('user', 'admin', 'owner', 'deliverer')),
  avatar_url text,
  is_owner boolean default false,
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
  state text,
  city text,
  is_open boolean not null default true,
  rating numeric(2,1) not null default 0,
  rating_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Address fields (for Asaas subaccount onboarding)
  postal_code text,
  address_street text,
  address_number text,
  neighborhood text,
  -- Pix details (for payouts from subaccount to company's bank)
  pix_key_type text check (pix_key_type is null or pix_key_type in ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP')),
  pix_key text,
  -- Traditional bank account details (TED fallback)
  bank_code text,
  bank_agency text,
  bank_account text,
  bank_account_digit text,
  bank_account_type text check (bank_account_type is null or bank_account_type in ('CONTA_CORRENTE', 'CONTA_POUPANCA')),
  bank_owner_name text,
  bank_cpf_cnpj text,
  -- Asaas Subaccount & Split fields
  asaas_account_id text,
  asaas_wallet_id text,
  asaas_api_key text,
  asaas_status text default 'not_created' check (asaas_status is null or asaas_status in ('not_created', 'pending', 'active', 'error')),
  platform_fee_percent numeric(5,2) default 20,
  -- Direct company data (convenience, avoids joining users)
  cnpj text,
  phone text,
  -- Theme
  primary_color text,
  secondary_color text,
  created_at timestamptz not null default now()
);

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null,
  description text,
  category_id text,
  image text,
  images text[],
  price_per_day numeric(10,2) not null default 0,
  available boolean not null default true,
  quantity integer not null default 1,
  min_days integer not null default 1,
  max_days integer not null default 30,
  rating numeric(2,1),
  rating_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Deliverers table (must be created before rentals since rentals references it)
create table if not exists public.deliverers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid references public.users (id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  customer_id uuid not null references public.users (id) on delete cascade,
  days integer not null default 1,
  total_price numeric(10,2) not null default 0,
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment', 'pending', 'accepted', 'rejected', 'delivering', 'delivered', 'active', 'completed', 'cancelled', 'return_expired')),
  rating integer check (rating between 1 and 5),
  rating_comment text,
  -- Payment fields
  payment_method text,
  payment_id text,
  payment_status text,
  payment_data jsonb,
  payment_gateway text,
  expires_at timestamptz,
  -- Shipping & Address
  shipping_price numeric(10,2) default 0,
  address jsonb,
  -- Coupons
  coupon_code text,
  coupon_discount numeric(10,2) default 0,
  -- Delivery tracking
  deliverer_id uuid references public.deliverers(id),
  delivered_at timestamptz,
  customer_note text,
  receiver_name text,
  receiver_cpf text,
  delivery_photos text[],
  -- Cancellation tracking
  cancelled_by uuid,
  cancelled_by_name text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.users enable row level security;
alter table public.companies enable row level security;
alter table public.tools enable row level security;
alter table public.rentals enable row level security;
alter table public.deliverers enable row level security;

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

create policy "deliverers_select" on public.deliverers
  for select using (
    exists (
      select 1 from public.companies c
      where c.id = deliverers.company_id and c.owner_id = auth.uid()
    )
    or
    auth.uid() = user_id
  );

create policy "deliverers_insert" on public.deliverers
  for insert with check (
    exists (
      select 1 from public.companies c
      where c.id = company_id and c.owner_id = auth.uid()
    )
  );

create policy "deliverers_update" on public.deliverers
  for update using (
    exists (
      select 1 from public.companies c
      where c.id = deliverers.company_id and c.owner_id = auth.uid()
    )
  );

create policy "deliverers_delete" on public.deliverers
  for delete using (
    exists (
      select 1 from public.companies c
      where c.id = deliverers.company_id and c.owner_id = auth.uid()
    )
  );

