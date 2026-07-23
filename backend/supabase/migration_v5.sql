-- ============================================================
-- Migration v5: Support return_expired status and cancellation tracking
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================

-- 1. Update the rentals_status_check constraint to include return_expired
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

-- 2. Add cancellation tracking columns to public.rentals if they don't exist
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS cancelled_by_name TEXT;
