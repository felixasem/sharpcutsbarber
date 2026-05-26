-- ============================================================
-- Atomic promo usage counter (called from Next.js API route)
-- ============================================================
create or replace function public.increment_promo_uses(promo_id uuid)
returns void language sql security definer as $$
  update public.promotions
  set current_uses = current_uses + 1
  where id = promo_id;
$$;

-- ============================================================
-- View: appointments_with_relations
-- Used by the admin dashboard for complex queries
-- ============================================================
create or replace view public.appointments_full as
select
  a.*,
  c.full_name       as customer_name,
  c.phone_whatsapp  as customer_phone,
  b.full_name       as barber_name,
  s.name            as service_name,
  s.duration_minutes,
  p.code            as promo_code,
  p.discount_percent
from public.appointments a
join public.profiles c on c.id = a.customer_id
join public.profiles b on b.id = a.barber_id
join public.services s  on s.id = a.service_id
left join public.promotions p on p.id = a.promotion_id;

-- RLS on the view (inherits from underlying tables via SECURITY INVOKER)
-- Staff can see all; customers see their own
create or replace function public.can_see_appointment_full(customer_id uuid, barber_id uuid)
returns boolean language sql security definer as $$
  select
    auth.uid() = customer_id
    or auth.uid() = barber_id
    or public.is_staff();
$$;

-- ============================================================
-- Indexes for performance
-- ============================================================
create index if not exists idx_appointments_time
  on public.appointments (appointment_time);

create index if not exists idx_appointments_barber_time
  on public.appointments (barber_id, appointment_time);

create index if not exists idx_appointments_customer
  on public.appointments (customer_id);

create index if not exists idx_appointments_reminders
  on public.appointments (appointment_time, reminder_24h_sent, reminder_2h_sent)
  where status in ('confirmed', 'pending');

create index if not exists idx_profiles_role_optin
  on public.profiles (role, whatsapp_opt_in);

create index if not exists idx_promotions_code
  on public.promotions (code)
  where active = true;
