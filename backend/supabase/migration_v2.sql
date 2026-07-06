-- ============================================================
-- Migration v2: Fix rentals table to match the backend model
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Drop the outdated status CHECK constraint
ALTER TABLE public.rentals
  DROP CONSTRAINT IF EXISTS rentals_status_check;

-- 2. Add the correct status CHECK constraint with all expected values
ALTER TABLE public.rentals
  ADD CONSTRAINT rentals_status_check
  CHECK (status IN (
    'awaiting_payment',
    'pending',
    'accepted',
    'rejected',
    'delivering',
    'delivered',
    'active',
    'completed',
    'cancelled'
  ));

-- 3. Fix the default status to 'awaiting_payment'
ALTER TABLE public.rentals
  ALTER COLUMN status SET DEFAULT 'awaiting_payment';

-- 4. Add missing columns (safe: IF NOT EXISTS prevents errors on re-run)
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS payment_method   text,
  ADD COLUMN IF NOT EXISTS payment_id       text,
  ADD COLUMN IF NOT EXISTS payment_status   text,
  ADD COLUMN IF NOT EXISTS payment_data     jsonb,
  ADD COLUMN IF NOT EXISTS shipping_price   numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS address          jsonb,
  ADD COLUMN IF NOT EXISTS coupon_code      text,
  ADD COLUMN IF NOT EXISTS coupon_discount  numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at       timestamptz,
  ADD COLUMN IF NOT EXISTS deliverer_id     uuid REFERENCES public.deliverers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivered_at     timestamptz;

-- Verify the fix:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'rentals' ORDER BY ordinal_position;
