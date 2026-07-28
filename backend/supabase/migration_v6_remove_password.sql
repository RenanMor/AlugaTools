-- Migration: Remove plaintext password column from users table
-- The password is already stored securely (hashed) in Supabase auth.users table.
-- Storing it again in public.users was a security vulnerability (plaintext exposure).

-- Step 1: Make the column nullable first (non-breaking)
ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL;

-- Step 2: Clear any existing plaintext passwords
UPDATE public.users SET password = NULL;

-- Step 3 (optional, run after verifying everything works):
-- ALTER TABLE public.users DROP COLUMN password;
