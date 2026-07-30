-- ============================================================
-- Migration v7: Add addresses jsonb column to public.users
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor)
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS addresses jsonb DEFAULT '[]'::jsonb;
