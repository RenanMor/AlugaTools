-- Migration: Add Asaas Split, Banking, and Address columns to companies table
-- Execute this in the Supabase SQL Editor or via CLI
-- Date: 2026-08-28

-- 1. Company approval status
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'approved', 'rejected'));

-- 2. Address fields (for Asaas subaccount onboarding)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address_street text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS neighborhood text;

-- 3. Pix details (for payouts from subaccount to company's real bank)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS pix_key_type text
  CHECK (pix_key_type IS NULL OR pix_key_type IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'EVP'));
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS pix_key text;

-- 4. Traditional bank account details (TED fallback if no Pix)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bank_code text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bank_agency text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bank_account text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bank_account_digit text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bank_account_type text
  CHECK (bank_account_type IS NULL OR bank_account_type IN ('CONTA_CORRENTE', 'CONTA_POUPANCA'));
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bank_owner_name text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS bank_cpf_cnpj text;

-- 5. Asaas Subaccount fields (for Split de Pagamentos)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS asaas_account_id text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS asaas_wallet_id text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS asaas_api_key text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS asaas_status text DEFAULT 'not_created'
  CHECK (asaas_status IS NULL OR asaas_status IN ('not_created', 'pending', 'active', 'error'));
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS platform_fee_percent numeric(5,2) DEFAULT 20;

-- 6. Company direct fields (CNPJ/phone for easy access without joining users)
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone text;

-- 7. Theme colors
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS primary_color text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS secondary_color text;

-- 8. Rental table: add missing columns used by the app
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS payment_id text;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS payment_status text;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS payment_data jsonb;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS payment_gateway text;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS shipping_price numeric(10,2) DEFAULT 0;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS address jsonb;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS coupon_discount numeric(10,2) DEFAULT 0;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS deliverer_id uuid REFERENCES public.deliverers(id);
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS customer_note text;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS receiver_name text;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS receiver_cpf text;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS delivery_photos text[];
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS cancelled_by uuid;
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS cancelled_by_name text;

-- 9. Update rentals status constraint to include all statuses used by the app
ALTER TABLE public.rentals DROP CONSTRAINT IF EXISTS rentals_status_check;
ALTER TABLE public.rentals ADD CONSTRAINT rentals_status_check
  CHECK (status IN ('awaiting_payment', 'pending', 'accepted', 'rejected', 'delivering', 'delivered', 'active', 'completed', 'cancelled', 'return_expired'));

-- 10. Users table: add missing columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_owner boolean DEFAULT false;

-- 11. Tools table: add missing columns
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS min_days integer DEFAULT 1;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS max_days integer DEFAULT 30;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS rating numeric(2,1);
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0;
ALTER TABLE public.tools ADD COLUMN IF NOT EXISTS images text[];
