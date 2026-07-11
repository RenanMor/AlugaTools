-- ============================================================
-- Migration v3: Approve Companies flow, Owner role, and Receiver details
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================

-- 1. Add status column to public.companies if it doesn't exist
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
  CONSTRAINT companies_status_check CHECK (status IN ('pending', 'approved', 'rejected'));

-- Approve all existing companies to prevent locking them out
UPDATE public.companies SET status = 'approved' WHERE status = 'pending';

-- 2. Add is_owner column to public.users if it doesn't exist
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

-- 3. Add customer note and receiver verification fields to public.rentals if they don't exist
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS customer_note text,
  ADD COLUMN IF NOT EXISTS receiver_name text,
  ADD COLUMN IF NOT EXISTS receiver_cpf text;
