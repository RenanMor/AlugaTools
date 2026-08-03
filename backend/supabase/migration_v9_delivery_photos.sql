-- ============================================================
-- Migration v9: Add delivery proof columns to rentals table
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add receiver_name column for delivery proof
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS receiver_name text;

-- 2. Add receiver_cpf column for delivery code verification
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS receiver_cpf text;

-- 3. Add delivery_photos column to store photo evidence (JSON array of base64/URLs)
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS delivery_photos jsonb;

-- 4. Add return_expired status to the CHECK constraint (if not already present)
ALTER TABLE public.rentals
  DROP CONSTRAINT IF EXISTS rentals_status_check;

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
    'cancelled',
    'return_expired'
  ));

-- Verify:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'rentals' ORDER BY ordinal_position;
