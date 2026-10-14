-- =============================================================================
-- Agentic Restaurant — core schema
-- Money is stored as integer paise. All tables carry id / created_at / updated_at.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('customer', 'staff', 'owner');
create type public.order_type as enum ('delivery', 'pickup', 'dine_in');
create type public.order_status as enum (
  'awaiting_payment', 'paid', 'accepted', 'preparing', 'ready',
  'out_for_delivery', 'completed', 'cancelled', 'refunded', 'payment_failed'
);
create type public.reservation_status as enum ('requested', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');
create type public.coupon_type as enum ('percent', 'flat');
create type public.review_sentiment as enum ('positive', 'neutral', 'negative');
create type public.open_override as enum ('auto', 'force_open', 'force_closed');
create type public.agent_kind as enum ('customer', 'owner');
create type public.audit_status as enum ('success', 'error', 'rejected_by_user', 'blocked');
create type public.alert_severity as enum ('info', 'warning', 'critical');

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  dietary_prefs text[] not null default '{}'
    check (dietary_prefs <@ array['veg', 'vegan', 'jain', 'gluten_free', 'no_onion_garlic']::text[]),
  spice_tolerance smallint not null default 2 check (spice_tolerance between 0 and 5),
  allergies text[] not null default '{}',
  default_address_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  label text not null default 'Home',
  line1 text not null,
  line2 text,
  city text not null,
  pincode text not null check (pincode ~ '^[0-9]{6}$'),
  lat double precision,
  lng double precision,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index addresses_user_idx on public.addresses (user_id);

alter table public.profiles
  add constraint profiles_default_address_fk foreign key (default_address_id)
  references public.addresses (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  name text not null,
  slug text not null unique,
  description text not null default '',
  price_paise int not null check (price_paise >= 0),
  image_url text,
  is_veg boolean not null default true,
  is_vegan boolean not null default false,
  is_jain boolean not null default false,
  spice_level smallint not null default 0 check (spice_level between 0 and 5),
  allergens text[] not null default '{}'
    check (allergens <@ array['dairy', 'gluten', 'nuts', 'peanut', 'soy', 'sesame', 'egg', 'shellfish']::text[]),
  tags text[] not null default '{}'
    check (tags <@ array['bestseller', 'chef_special', 'new', 'healthy', 'kids']::text[]),
  calories int,
  prep_time_min int not null default 15,
  portion text,
  is_available boolean not null default true,
  is_deleted boolean not null default false,
  stock_qty int check (stock_qty is null or stock_qty >= 0),
  low_stock_threshold int not null default 5,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index menu_items_category_idx on public.menu_items (category_id);

create table public.item_variants (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  name text not null,
  price_delta_paise int not null default 0,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index item_variants_item_idx on public.item_variants (menu_item_id);

create table public.item_addons (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  name text not null,
  price_paise int not null check (price_paise >= 0),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index item_addons_item_idx on public.item_addons (menu_item_id);

create table public.pairings (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.menu_items (id) on delete cascade,
  paired_item_id uuid not null references public.menu_items (id) on delete cascade,
  reason text,
  weight smallint not null default 5 check (weight between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (item_id, paired_item_id),
  check (item_id <> paired_item_id)
);

-- ---------------------------------------------------------------------------
-- Settings & tables
-- ---------------------------------------------------------------------------
create table public.restaurant_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  name text not null,
  tagline text,
  phone text,
  email text,
  address text,
  lat double precision,
  lng double precision,
  timezone text not null default 'Asia/Kolkata',
  opening_hours jsonb not null default '{}'::jsonb,
  is_open_override public.open_override not null default 'auto',
  delivery_radius_km numeric not null default 6,
  serviceable_pincodes text[] not null default '{}',
  delivery_fee_paise int not null default 3000,
  free_delivery_above_paise int not null default 49900,
  packaging_fee_paise int not null default 1500,
  gst_percent numeric(5, 2) not null default 5,
  min_order_paise int not null default 10000,
  avg_prep_minutes int not null default 20,
  accepting_orders boolean not null default true,
  announcement text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  number int not null unique,
  capacity int not null check (capacity > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  description text,
  type public.coupon_type not null,
  value int not null check (value > 0), -- percent (1-100) or flat paise
  min_order_paise int not null default 0,
  max_discount_paise int,
  valid_from timestamptz,
  valid_to timestamptz,
  usage_limit int,
  per_user_limit int default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check (type <> 'percent' or value <= 100)
);

-- ---------------------------------------------------------------------------
-- Cart
-- ---------------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (user_id) on delete cascade,
  coupon_code text,
  order_type public.order_type not null default 'delivery',
  table_number int,
  address_id uuid references public.addresses (id) on delete set null,
  scheduled_for timestamptz,
  tip_paise int not null default 0 check (tip_paise between 0 and 100000),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  variant_id uuid references public.item_variants (id) on delete set null,
  addon_ids uuid[] not null default '{}',
  qty int not null check (qty between 1 and 20),
  special_instructions text check (char_length(special_instructions) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index cart_items_cart_idx on public.cart_items (cart_id);

-- ---------------------------------------------------------------------------
-- Orders & payments
-- ---------------------------------------------------------------------------
create table public.order_counters (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  n int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references public.profiles (user_id),
  status public.order_status not null default 'awaiting_payment',
  order_type public.order_type not null,
  address_snapshot jsonb,
  table_number int,
  scheduled_for timestamptz,
  subtotal_paise int not null,
  discount_paise int not null default 0,
  tax_paise int not null default 0,
  delivery_fee_paise int not null default 0,
  packaging_fee_paise int not null default 0,
  tip_paise int not null default 0,
  total_paise int not null check (total_paise >= 0),
  coupon_code text,
  notes text,
  razorpay_order_id text unique,
  razorpay_payment_id text,
  paid_at timestamptz,
  cancelled_reason text,
  estimated_ready_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status);
create index orders_created_idx on public.orders (created_at);
create index orders_paid_idx on public.orders (paid_at);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  name_snapshot text not null,
  unit_price_paise int not null,
  variant_snapshot jsonb,
  addons_snapshot jsonb not null default '[]'::jsonb,
  qty int not null check (qty > 0),
  line_total_paise int not null,
  special_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_item_idx on public.order_items (menu_item_id);

create table public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  status public.order_status not null,
  actor_user_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index order_status_events_order_idx on public.order_status_events (order_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  razorpay_order_id text,
  razorpay_payment_id text unique,
  amount_paise int not null,
  status text not null,
  method text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index payments_order_idx on public.payments (order_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  razorpay_payment_id text not null,
  razorpay_refund_id text unique,
  amount_paise int not null check (amount_paise > 0),
  status text not null default 'initiated',
  reason text,
  initiated_by uuid,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Reservations, reviews, favorites
-- ---------------------------------------------------------------------------
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  party_size int not null check (party_size between 1 and 20),
  reserved_for timestamptz not null,
  status public.reservation_status not null default 'requested',
  table_number int,
  notes text check (char_length(notes) <= 500),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index reservations_time_idx on public.reservations (reserved_for);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  sentiment public.review_sentiment,
  owner_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index reviews_item_idx on public.reviews (menu_item_id);
create index reviews_created_idx on public.reviews (created_at);
create unique index reviews_one_per_item on public.reviews (order_id, coalesce(menu_item_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (user_id, menu_item_id)
);

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text not null,
  qty numeric not null default 0,
  low_threshold numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  qty_per_unit numeric not null check (qty_per_unit > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (menu_item_id, inventory_item_id)
);

-- ---------------------------------------------------------------------------
-- Agents
-- ---------------------------------------------------------------------------
create table public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  agent public.agent_kind not null,
  title text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index agent_conversations_user_idx on public.agent_conversations (user_id, agent, last_message_at desc);

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.agent_conversations (id) on delete cascade,
  role text not null,
  content jsonb not null,
  tool_calls jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index agent_messages_conv_idx on public.agent_messages (conversation_id, created_at);

create table public.agent_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  agent public.agent_kind not null,
  tool_name text not null,
  params jsonb,
  result_summary text,
  status public.audit_status not null,
  confirmed_by_user boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index agent_audit_created_idx on public.agent_audit_log (created_at desc);

create table public.owner_alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text,
  severity public.alert_severity not null default 'info',
  is_read boolean not null default false,
  data jsonb,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table public.rate_limits (
  id uuid primary key default gen_random_uuid(),
  bucket text not null unique,
  window_start timestamptz not null,
  count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ---------------------------------------------------------------------------
-- updated_at triggers on every table
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.restaurant_tz() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select timezone from public.restaurant_settings limit 1), 'Asia/Kolkata');
$$;

create or replace function public.current_app_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where user_id = auth.uid();
$$;

create or replace function public.is_staff_or_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() in ('staff', 'owner'), false);
$$;

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = 'owner', false);
$$;

create or replace function public.mask_phone(p text) returns text
language sql immutable as $$
  select case
    when p is null or length(regexp_replace(p, '\D', '', 'g')) < 4 then null
    else left(regexp_replace(p, '\D', '', 'g'), 2)
      || repeat('x', length(regexp_replace(p, '\D', '', 'g')) - 4)
      || right(regexp_replace(p, '\D', '', 'g'), 2)
  end;
$$;

create or replace function public.mask_email(p text) returns text
language sql immutable as $$
  select case
    when p is null or position('@' in p) < 2 then null
    else left(p, 1) || repeat('*', greatest(position('@' in p) - 2, 1)) || substr(p, position('@' in p))
  end;
$$;

-- Profile row for every auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.phone, new.raw_user_meta_data ->> 'phone')
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Customers may not change their own role (column grants below also enforce this).
create or replace function public.guard_profile_role() returns trigger
language plpgsql as $$
begin
  -- Requests made with a client JWT (anon/authenticated) can never change roles.
  if new.role is distinct from old.role and coalesce(auth.role(), '') in ('anon', 'authenticated') then
    raise exception 'role changes are not allowed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_profile_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Human-friendly order numbers: ORD-YYYYMMDD-0042 (per-day counter in restaurant tz).
create or replace function public.next_order_number() returns text
language plpgsql security definer set search_path = public as $$
declare
  d date := (now() at time zone public.restaurant_tz())::date;
  v int;
begin
  insert into public.order_counters (day, n) values (d, 1)
  on conflict (day) do update set n = public.order_counters.n + 1
  returning n into v;
  return 'ORD-' || to_char(d, 'YYYYMMDD') || '-' || lpad(v::text, 4, '0');
end $$;

-- ---------------------------------------------------------------------------
-- PAYMENT SAFETY: an order may only become `paid` (or `refunded` / `payment_failed`)
-- inside the verified payment-webhook context. The context flag is set
-- transaction-locally by mark_order_paid / mark_payment_failed / mark_order_refunded,
-- which are executable by service_role only and are never called by agent code.
-- ---------------------------------------------------------------------------
create or replace function public.guard_order_status() returns trigger
language plpgsql as $$
declare ctx text := coalesce(current_setting('app.payment_context', true), '');
begin
  if ctx in ('webhook', 'seed') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'awaiting_payment' or new.paid_at is not null or new.razorpay_payment_id is not null then
      raise exception 'orders must be created in awaiting_payment' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.paid_at is distinct from old.paid_at or new.razorpay_payment_id is distinct from old.razorpay_payment_id then
    raise exception 'payment fields are writable only by the payment webhook' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if new.status in ('paid', 'refunded', 'payment_failed') then
      raise exception 'status % can only be set by the payment webhook', new.status using errcode = '42501';
    end if;
    if old.status in ('awaiting_payment', 'payment_failed') and new.status <> 'cancelled' then
      raise exception 'unpaid orders can only be cancelled' using errcode = '42501';
    end if;
    if old.status in ('completed', 'cancelled', 'refunded') then
      raise exception 'order is closed (%)', old.status using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger guard_order_status before insert or update on public.orders
  for each row execute function public.guard_order_status();

-- Every status change is recorded in the timeline.
create or replace function public.log_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('app.payment_context', true), '') = 'seed' then
    return new;
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_events (order_id, status, actor_user_id, note)
    values (new.id, new.status, nullif(current_setting('app.actor_user_id', true), '')::uuid,
            nullif(current_setting('app.status_note', true), ''));
  end if;
  return new;
end $$;

create trigger log_order_status after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- Mark an order paid from a verified webhook. Idempotent; also decrements stock
-- and inventory and records the coupon redemption.
create or replace function public.mark_order_paid(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_amount_paise int,
  p_method text,
  p_raw jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  li record;
  c public.coupons%rowtype;
begin
  select * into o from public.orders where razorpay_order_id = p_razorpay_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found');
  end if;

  if exists (select 1 from public.payments where razorpay_payment_id = p_razorpay_payment_id and status = 'captured') then
    return jsonb_build_object('ok', true, 'duplicate', true, 'order_id', o.id);
  end if;

  insert into public.payments (order_id, razorpay_order_id, razorpay_payment_id, amount_paise, status, method, raw)
  values (o.id, p_razorpay_order_id, p_razorpay_payment_id, p_amount_paise, 'captured', p_method, p_raw)
  on conflict (razorpay_payment_id) do update set status = 'captured', raw = excluded.raw, method = excluded.method;

  if o.status not in ('awaiting_payment', 'payment_failed', 'cancelled') then
    return jsonb_build_object('ok', true, 'duplicate', true, 'order_id', o.id);
  end if;

  if p_amount_paise <> o.total_paise then
    insert into public.owner_alerts (type, title, body, severity, data)
    values ('payment_mismatch', 'Payment amount mismatch',
            format('Order %s: paid %s paise, expected %s paise', o.order_number, p_amount_paise, o.total_paise),
            'critical', jsonb_build_object('order_id', o.id));
  end if;

  perform set_config('app.payment_context', 'webhook', true);
  perform set_config('app.status_note', 'Payment received (' || coalesce(p_method, 'online') || ')', true);
  update public.orders
     set status = 'paid', paid_at = now(), razorpay_payment_id = p_razorpay_payment_id,
         cancelled_reason = null
   where id = o.id;
  perform set_config('app.payment_context', '', true);
  perform set_config('app.status_note', '', true);

  for li in select menu_item_id, qty from public.order_items where order_id = o.id and menu_item_id is not null loop
    update public.menu_items
       set stock_qty = greatest(stock_qty - li.qty, 0),
           is_available = case when stock_qty - li.qty <= 0 then false else is_available end
     where id = li.menu_item_id and stock_qty is not null;
    update public.inventory_items inv
       set qty = greatest(inv.qty - ri.qty_per_unit * li.qty, 0)
      from public.recipe_ingredients ri
     where ri.inventory_item_id = inv.id and ri.menu_item_id = li.menu_item_id;
  end loop;

  if o.coupon_code is not null then
    select * into c from public.coupons where code = o.coupon_code;
    if found then
      insert into public.coupon_redemptions (coupon_id, user_id, order_id)
      values (c.id, o.user_id, o.id) on conflict (order_id) do nothing;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'order_id', o.id, 'order_number', o.order_number);
end $$;

create or replace function public.mark_payment_failed(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_amount_paise int,
  p_method text,
  p_raw jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where razorpay_order_id = p_razorpay_order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found');
  end if;
  insert into public.payments (order_id, razorpay_order_id, razorpay_payment_id, amount_paise, status, method, raw)
  values (o.id, p_razorpay_order_id, p_razorpay_payment_id, p_amount_paise, 'failed', p_method, p_raw)
  on conflict (razorpay_payment_id) do nothing;
  if o.status = 'awaiting_payment' then
    perform set_config('app.payment_context', 'webhook', true);
    perform set_config('app.status_note', 'Payment failed — you can retry', true);
    update public.orders set status = 'payment_failed' where id = o.id;
    perform set_config('app.payment_context', '', true);
    perform set_config('app.status_note', '', true);
  end if;
  return jsonb_build_object('ok', true, 'order_id', o.id);
end $$;

create or replace function public.mark_order_refunded(
  p_razorpay_refund_id text,
  p_razorpay_payment_id text,
  p_amount_paise int,
  p_raw jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  o public.orders%rowtype;
  refunded_total int;
begin
  select * into o from public.orders where razorpay_payment_id = p_razorpay_payment_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'order_not_found');
  end if;
  insert into public.refunds (order_id, razorpay_payment_id, razorpay_refund_id, amount_paise, status, raw)
  values (o.id, p_razorpay_payment_id, p_razorpay_refund_id, p_amount_paise, 'processed', p_raw)
  on conflict (razorpay_refund_id) do update set status = 'processed', raw = excluded.raw;

  select coalesce(sum(amount_paise), 0) into refunded_total
    from public.refunds where order_id = o.id and status = 'processed';

  if refunded_total >= o.total_paise and o.status <> 'refunded' then
    perform set_config('app.payment_context', 'webhook', true);
    perform set_config('app.status_note', 'Refund processed', true);
    update public.orders set status = 'refunded' where id = o.id;
    perform set_config('app.payment_context', '', true);
    perform set_config('app.status_note', '', true);
  end if;
  return jsonb_build_object('ok', true, 'order_id', o.id, 'refunded_total_paise', refunded_total);
end $$;

revoke all on function public.mark_order_paid(text, text, int, text, jsonb) from public, anon, authenticated;
revoke all on function public.mark_payment_failed(text, text, int, text, jsonb) from public, anon, authenticated;
revoke all on function public.mark_order_refunded(text, text, int, jsonb) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text, text, int, text, jsonb) to service_role;
grant execute on function public.mark_payment_failed(text, text, int, text, jsonb) to service_role;
grant execute on function public.mark_order_refunded(text, text, int, jsonb) to service_role;

-- Status update helper used by owner/staff tools and customer cancellation.
-- Records actor + note in the timeline. The guard trigger still applies.
create or replace function public.set_order_status(
  p_order_id uuid,
  p_status public.order_status,
  p_actor uuid,
  p_note text default null,
  p_eta_minutes int default null,
  p_cancel_reason text default null
) returns public.orders
language plpgsql security definer set search_path = public as $$
declare o public.orders;
begin
  perform set_config('app.actor_user_id', coalesce(p_actor::text, ''), true);
  perform set_config('app.status_note', coalesce(p_note, ''), true);
  update public.orders
     set status = p_status,
         estimated_ready_at = case when p_eta_minutes is not null then now() + make_interval(mins => p_eta_minutes) else estimated_ready_at end,
         cancelled_reason = case when p_status = 'cancelled' then coalesce(p_cancel_reason, cancelled_reason) else cancelled_reason end
   where id = p_order_id
  returning * into o;
  perform set_config('app.actor_user_id', '', true);
  perform set_config('app.status_note', '', true);
  if o.id is null then
    raise exception 'order not found';
  end if;
  return o;
end $$;
revoke all on function public.set_order_status(uuid, public.order_status, uuid, text, int, text) from public, anon, authenticated;
grant execute on function public.set_order_status(uuid, public.order_status, uuid, text, int, text) to service_role;

-- Fixed-window rate limiter (used by agent routes).
create or replace function public.hit_rate_limit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare r public.rate_limits%rowtype;
begin
  insert into public.rate_limits (bucket, window_start, count) values (p_bucket, now(), 1)
  on conflict (bucket) do update
    set count = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                     then 1 else public.rate_limits.count + 1 end,
        window_start = case when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
                     then now() else public.rate_limits.window_start end
  returning * into r;
  return r.count <= p_limit;
end $$;
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

-- Public read models -------------------------------------------------------
create or replace view public.menu_item_stats as
  select m.id as menu_item_id,
         coalesce(round(avg(r.rating)::numeric, 2), 0) as avg_rating,
         count(r.id) as review_count,
         coalesce((select sum(oi.qty) from public.order_items oi
                     join public.orders o on o.id = oi.order_id
                    where oi.menu_item_id = m.id
                      and o.status in ('paid', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed')
                      and o.created_at > now() - interval '30 days'), 0) as sold_30d
    from public.menu_items m
    left join public.reviews r on r.menu_item_id = m.id
   where not m.is_deleted
   group by m.id;

create or replace view public.public_reviews as
  select r.id, r.menu_item_id, r.rating, r.comment, r.owner_reply, r.created_at,
         split_part(coalesce(p.full_name, 'Guest'), ' ', 1) as reviewer_name
    from public.reviews r
    left join public.profiles p on p.user_id = r.user_id;

grant select on public.menu_item_stats to anon, authenticated;
grant select on public.public_reviews to anon, authenticated;
