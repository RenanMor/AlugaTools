-- Migration v8: Add images jsonb column to tools table for storing optional images
ALTER TABLE public.tools
  ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;
