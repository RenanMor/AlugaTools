-- ============================================================
-- Migration v4: Dynamic UI branding (primary/secondary colors)
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add primary_color and secondary_color columns to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS secondary_color text;

-- 2. Add primary_color and secondary_color columns to public.companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS secondary_color text;
