-- ============================================================
-- Fix: Allow customers to read barber profiles for booking
-- Fix: Allow authenticated users to see all barbers/admins
-- ============================================================

-- Customers need to see barber profiles to book with them
create policy "Anyone can view barber profiles"
  on public.profiles for select
  using (role in ('barber', 'admin'));

-- Allow service_role to bypass RLS for all tables (already default,
-- but making it explicit for edge functions)
alter table public.profiles force row level security;
