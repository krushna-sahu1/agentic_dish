-- =============================================================================
-- Owner bulk email (draft_email tool → preview card → owner taps Send).
-- The AI can only create/edit drafts. Sending happens in server code after a
-- human tap (app/actions/email.ts), via Resend's batch API.
-- =============================================================================

-- Coupons attached to a draft email stay unusable until the owner taps Send.
alter table public.coupons add column if not exists is_draft boolean not null default false;

-- Anyone who unsubscribed (one-click header, footer link or profile toggle).
-- Stored by lower-cased email so it also covers addresses that aren't accounts.
create table public.email_unsubscribes (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

create table public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent', 'cancelled', 'failed')),
  version int not null default 1,          -- bumped on every edit; Send must name the version it previewed
  goal text,
  audience jsonb not null,                  -- the "to" spec (emails or group + parameters)
  audience_label text not null,
  recipient_count int not null default 0,
  subject text not null check (char_length(subject) between 1 and 150),
  message text not null check (char_length(message) between 1 and 5000),
  coupon_id uuid references public.coupons (id) on delete set null,
  sent_count int not null default 0,
  failed_count int not null default 0,
  error text,
  sent_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index email_drafts_created_idx on public.email_drafts (created_at desc);

create table public.email_sends (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.email_drafts (id) on delete cascade,
  email text not null,
  user_id uuid,
  resend_id text,
  status text not null check (status in ('sent', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  unique (draft_id, email)
);

alter table public.email_unsubscribes enable row level security;
alter table public.email_drafts enable row level security;
alter table public.email_sends enable row level security;
create policy email_drafts_owner_read on public.email_drafts for select using (public.is_owner());
create policy email_sends_owner_read on public.email_sends for select using (public.is_owner());
create policy email_unsubscribes_owner_read on public.email_unsubscribes for select using (public.is_owner());

-- ---------------------------------------------------------------------------
-- Recipients for a group. Service role only (it reads auth.users emails).
--   all           every customer
--   inactive      ordered before, but not in the last p_days
--   new           first order within the last p_days
--   loyal         p_min_orders+ orders
--   big_spenders  spent p_min_spend_paise+ in total
--   ordered_dish  ordered menu item p_dish_id before
--   emails        exactly p_emails (names filled in when they're customers)
-- Unsubscribed addresses are always excluded. Orders count only revenue statuses.
-- ---------------------------------------------------------------------------
create or replace function public.email_audience(
  p_group text,
  p_days int default 30,
  p_min_orders int default 3,
  p_min_spend_paise int default 200000,
  p_dish_id uuid default null,
  p_emails text[] default null
) returns table (user_id uuid, email text, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  -- Only the server (service role) may list customer emails; grants below enforce it too.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'email audience access denied' using errcode = '42501';
  end if;

  if p_group = 'emails' then
    return query
      select u.id, e.addr, p.full_name
        from (select distinct lower(trim(x)) as addr from unnest(coalesce(p_emails, '{}')) as x where trim(x) <> '') e
        left join auth.users u on lower(u.email) = e.addr
        left join public.profiles p on p.user_id = u.id
       where not exists (select 1 from public.email_unsubscribes s where s.email = e.addr)
       order by e.addr;
    return;
  end if;

  return query
    with stats as (
      select o.user_id as uid, count(*)::int as orders, coalesce(sum(o.total_paise), 0)::bigint as spend,
             min(o.created_at) as first_at, max(o.created_at) as last_at
        from public.orders o
       where public.is_revenue_status(o.status)
       group by o.user_id
    )
    select p.user_id, lower(u.email)::text, p.full_name
      from public.profiles p
      join auth.users u on u.id = p.user_id
      left join stats s on s.uid = p.user_id
     where p.role = 'customer'
       and u.email is not null and u.email <> ''
       and not exists (select 1 from public.email_unsubscribes x where x.email = lower(u.email))
       and case p_group
             when 'all' then true
             when 'inactive' then s.last_at is not null and s.last_at < now() - make_interval(days => p_days)
             when 'new' then s.first_at >= now() - make_interval(days => p_days)
             when 'loyal' then coalesce(s.orders, 0) >= p_min_orders
             when 'big_spenders' then coalesce(s.spend, 0) >= p_min_spend_paise
             when 'ordered_dish' then exists (
               select 1 from public.order_items oi join public.orders o on o.id = oi.order_id
                where o.user_id = p.user_id and oi.menu_item_id = p_dish_id and public.is_revenue_status(o.status))
             else false
           end
     order by lower(u.email);
end $$;

revoke all on function public.email_audience(text, int, int, int, uuid, text[]) from public, anon, authenticated;
grant execute on function public.email_audience(text, int, int, int, uuid, text[]) to service_role;
