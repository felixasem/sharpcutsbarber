-- ============================================================
-- SharpCuts Barbershop - Initial Schema
-- ============================================================

-- Extensions
create extension if not exists "pg_cron";
create extension if not exists "pg_net";

-- ============================================================
-- TABLES (order matters for foreign keys)
-- ============================================================

-- 1. Profiles (extends Supabase auth.users)
create table public.profiles (
  id              uuid references auth.users on delete cascade primary key,
  full_name       text        not null,
  phone_whatsapp  text        not null default '',
  role            text        not null default 'customer'
                              check (role in ('customer', 'barber', 'admin')),
  whatsapp_opt_in boolean     not null default true,
  avatar_url      text,
  bio             text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 2. Services
create table public.services (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null,
  description      text,
  price            numeric(10,2) not null check (price >= 0),
  duration_minutes integer     not null check (duration_minutes > 0),
  is_addon         boolean     not null default false,
  is_active        boolean     not null default true,
  sort_order       integer     not null default 0,
  image_url        text,
  created_at       timestamptz not null default now()
);

-- 3. Barber working-hour templates
create table public.barber_schedules (
  id           uuid    primary key default gen_random_uuid(),
  barber_id    uuid    not null references public.profiles(id) on delete cascade,
  day_of_week  integer not null check (day_of_week between 0 and 6),
  start_time   time    not null,
  end_time     time    not null,
  is_working   boolean not null default true,
  unique (barber_id, day_of_week)
);

-- 4. Promotions (must exist before appointments)
create table public.promotions (
  id               uuid        primary key default gen_random_uuid(),
  code             text        not null unique,
  description      text        not null,
  discount_percent numeric(5,2) not null check (discount_percent > 0 and discount_percent <= 100),
  active           boolean     not null default true,
  valid_from       timestamptz not null default now(),
  valid_until      timestamptz,
  max_uses         integer,
  current_uses     integer     not null default 0,
  created_by       uuid        references public.profiles(id),
  created_at       timestamptz not null default now()
);

-- 5. Appointments
create table public.appointments (
  id                   uuid        primary key default gen_random_uuid(),
  customer_id          uuid        not null references public.profiles(id) on delete cascade,
  barber_id            uuid        not null references public.profiles(id) on delete cascade,
  service_id           uuid        not null references public.services(id),
  appointment_time     timestamptz not null,
  end_time             timestamptz not null,
  status               text        not null default 'confirmed'
                                   check (status in ('pending','confirmed','completed','cancelled','no_show')),
  notes                text,
  total_price          numeric(10,2) not null check (total_price >= 0),
  promotion_id         uuid        references public.promotions(id),
  discount_amount      numeric(10,2) not null default 0,
  reminder_24h_sent    boolean     not null default false,
  reminder_2h_sent     boolean     not null default false,
  confirmation_sent    boolean     not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- 6. Add-on services attached to an appointment
create table public.appointment_addons (
  appointment_id uuid          not null references public.appointments(id) on delete cascade,
  service_id     uuid          not null references public.services(id),
  price          numeric(10,2) not null,
  primary key (appointment_id, service_id)
);

-- 7. WhatsApp outbound message log
create table public.whatsapp_message_log (
  id                  uuid        primary key default gen_random_uuid(),
  recipient_phone     text        not null,
  template_name       text        not null,
  template_variables  jsonb,
  provider            text        not null default 'twilio',
  provider_message_id text,
  status              text        not null default 'pending',
  error_message       text,
  appointment_id      uuid        references public.appointments(id),
  sent_at             timestamptz,
  created_at          timestamptz not null default now()
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.handle_updated_at();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGN-UP
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone_whatsapp)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Customer'),
    coalesce(new.raw_user_meta_data->>'phone_whatsapp', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles            enable row level security;
alter table public.services            enable row level security;
alter table public.barber_schedules    enable row level security;
alter table public.appointments        enable row level security;
alter table public.appointment_addons  enable row level security;
alter table public.promotions          enable row level security;
alter table public.whatsapp_message_log enable row level security;

create or replace function public.is_staff()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('barber', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- profiles
create policy "Users view own profile"       on public.profiles for select using (auth.uid() = id);
create policy "Staff view all profiles"      on public.profiles for select using (public.is_staff());
create policy "Users insert own profile"     on public.profiles for insert with check (auth.uid() = id);
create policy "Users update own profile"     on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));

-- services
create policy "Anyone views active services" on public.services for select using (is_active = true);
create policy "Staff views all services"     on public.services for select using (public.is_staff());
create policy "Staff manages services"       on public.services for all using (public.is_staff());

-- barber_schedules
create policy "Anyone views schedules"       on public.barber_schedules for select using (true);
create policy "Barbers manage own schedule"  on public.barber_schedules for all using (auth.uid() = barber_id);
create policy "Admins manage all schedules"  on public.barber_schedules for all using (public.is_admin());

-- appointments
create policy "Customers see own appts"      on public.appointments for select using (auth.uid() = customer_id);
create policy "Barbers see own appts"        on public.appointments for select using (auth.uid() = barber_id);
create policy "Staff sees all appts"         on public.appointments for select using (public.is_staff());
create policy "Customers create appts"       on public.appointments for insert with check (auth.uid() = customer_id);
create policy "Customers cancel own appts"   on public.appointments for update
  using (auth.uid() = customer_id) with check (status = 'cancelled');
create policy "Staff updates any appt"       on public.appointments for update using (public.is_staff());

-- appointment_addons
create policy "Users see own addons"         on public.appointment_addons for select
  using (exists (select 1 from public.appointments a where a.id = appointment_id and (a.customer_id = auth.uid() or a.barber_id = auth.uid())));
create policy "Staff sees all addons"        on public.appointment_addons for select using (public.is_staff());
create policy "Customers add addons"         on public.appointment_addons for insert
  with check (exists (select 1 from public.appointments a where a.id = appointment_id and a.customer_id = auth.uid()));

-- promotions
create policy "Anyone reads active promos"   on public.promotions for select using (active = true);
create policy "Staff manages promos"         on public.promotions for all using (public.is_staff());

-- whatsapp_message_log
create policy "Staff views message logs"     on public.whatsapp_message_log for select using (public.is_staff());

-- ============================================================
-- SEED DATA
-- ============================================================
insert into public.services (name, description, price, duration_minutes, is_addon, sort_order) values
  ('Classic Haircut',     'Scissor & clipper cut with style finish',       150.00, 45, false, 1),
  ('Skin Fade',           'Graduated fade from skin to length',            180.00, 50, false, 2),
  ('Beard Trim & Shape',  'Define your beard line with hot towel finish',   80.00, 20, false, 3),
  ('Kids Cut (under 12)', 'Gentle cut for the little ones',                100.00, 30, false, 4),
  ('Hot Towel Shave',     'Traditional straight-razor hot towel shave',     90.00, 25, true,  5),
  ('Scalp Massage',       'Relaxing 10-min scalp massage with oils',        50.00, 10, true,  6),
  ('Face Mask Treatment', 'Purifying charcoal mask & moisturiser',          60.00, 15, true,  7),
  ('Eyebrow Threading',   'Clean, defined brow shaping',                    40.00, 10, true,  8);
