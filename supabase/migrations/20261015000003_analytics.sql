-- =============================================================================
-- Read-only analytics RPCs (owner-only). The owner agent calls these instead
-- of writing SQL. Ranges are half-open [p_from, p_to). Bucketing happens in the
-- restaurant timezone. Revenue = orders in paid..completed (never cancelled,
-- refunded, payment_failed or awaiting_payment).
-- =============================================================================

create or replace function public.assert_analytics_access() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') = 'service_role' or public.is_owner() then
    return;
  end if;
  raise exception 'analytics access denied' using errcode = '42501';
end $$;

create or replace function public.is_revenue_status(s public.order_status) returns boolean
language sql immutable as $$
  select s in ('paid', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed');
$$;

-- Revenue / orders / AOV per bucket ------------------------------------------------
create or replace function public.analytics_revenue(p_from timestamptz, p_to timestamptz, p_granularity text default 'day')
returns table (bucket timestamp, revenue_paise bigint, orders bigint, aov_paise bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  tz text := public.restaurant_tz();
  g text := case when p_granularity in ('hour', 'day', 'week', 'month') then p_granularity else 'day' end;
begin
  perform public.assert_analytics_access();
  return query
  with buckets as (
    select gs as b
      from generate_series(
        date_trunc(g, p_from at time zone tz),
        date_trunc(g, (p_to - interval '1 microsecond') at time zone tz),
        ('1 ' || g)::interval) gs
  ), o as (
    select date_trunc(g, coalesce(x.paid_at, x.created_at) at time zone tz) as b, x.total_paise
      from public.orders x
     where public.is_revenue_status(x.status)
       and coalesce(x.paid_at, x.created_at) >= p_from and coalesce(x.paid_at, x.created_at) < p_to
  )
  select buckets.b,
         coalesce(sum(o.total_paise), 0)::bigint,
         count(o.total_paise)::bigint,
         case when count(o.total_paise) > 0 then (sum(o.total_paise) / count(o.total_paise))::bigint else 0::bigint end
    from buckets left join o on o.b = buckets.b
   group by buckets.b
   order by buckets.b;
end $$;

-- Item rankings ----------------------------------------------------------------------
create or replace function public.analytics_top_items(p_from timestamptz, p_to timestamptz, p_limit int default 10, p_order_by text default 'revenue')
returns table (menu_item_id uuid, name text, category text, qty bigint, revenue_paise bigint, orders bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.assert_analytics_access();
  return query
  select m.id, m.name, c.name,
         sum(oi.qty)::bigint, sum(oi.line_total_paise)::bigint, count(distinct o.id)::bigint
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.menu_items m on m.id = oi.menu_item_id
    join public.categories c on c.id = m.category_id
   where public.is_revenue_status(o.status)
     and coalesce(o.paid_at, o.created_at) >= p_from and coalesce(o.paid_at, o.created_at) < p_to
   group by m.id, m.name, c.name
   order by case when p_order_by = 'qty' then sum(oi.qty) else sum(oi.line_total_paise) end desc
   limit greatest(least(p_limit, 50), 1);
end $$;

create or replace function public.analytics_bottom_items(p_from timestamptz, p_to timestamptz, p_limit int default 10)
returns table (menu_item_id uuid, name text, category text, qty bigint, revenue_paise bigint, orders bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.assert_analytics_access();
  return query
  with sales as (
    select oi.menu_item_id as mid, sum(oi.qty) as q, sum(oi.line_total_paise) as r, count(distinct o.id) as n
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
     where public.is_revenue_status(o.status)
       and coalesce(o.paid_at, o.created_at) >= p_from and coalesce(o.paid_at, o.created_at) < p_to
     group by oi.menu_item_id
  )
  select m.id, m.name, c.name,
         coalesce(s.q, 0)::bigint, coalesce(s.r, 0)::bigint, coalesce(s.n, 0)::bigint
    from public.menu_items m
    join public.categories c on c.id = m.category_id
    left join sales s on s.mid = m.id
   where not m.is_deleted
   order by coalesce(s.r, 0) asc, m.name
   limit greatest(least(p_limit, 50), 1);
end $$;

create or replace function public.analytics_category_breakdown(p_from timestamptz, p_to timestamptz)
returns table (category_id uuid, category text, qty bigint, revenue_paise bigint, share numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.assert_analytics_access();
  return query
  with s as (
    select c.id as cid, c.name as cname, sum(oi.qty) as q, sum(oi.line_total_paise) as r
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      join public.menu_items m on m.id = oi.menu_item_id
      join public.categories c on c.id = m.category_id
     where public.is_revenue_status(o.status)
       and coalesce(o.paid_at, o.created_at) >= p_from and coalesce(o.paid_at, o.created_at) < p_to
     group by c.id, c.name
  )
  select s.cid, s.cname, s.q::bigint, s.r::bigint,
         case when sum(s.r) over () > 0 then round(s.r * 100.0 / sum(s.r) over (), 1) else 0 end
    from s order by s.r desc;
end $$;

-- Weekday x hour heatmap (weekday: 0 = Sunday) -----------------------------------
create or replace function public.analytics_peak_hours(p_from timestamptz, p_to timestamptz)
returns table (weekday int, hour int, orders bigint, revenue_paise bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare tz text := public.restaurant_tz();
begin
  perform public.assert_analytics_access();
  return query
  select extract(dow from coalesce(o.paid_at, o.created_at) at time zone tz)::int,
         extract(hour from coalesce(o.paid_at, o.created_at) at time zone tz)::int,
         count(*)::bigint, sum(o.total_paise)::bigint
    from public.orders o
   where public.is_revenue_status(o.status)
     and coalesce(o.paid_at, o.created_at) >= p_from and coalesce(o.paid_at, o.created_at) < p_to
   group by 1, 2
   order by 1, 2;
end $$;

create or replace function public.analytics_order_type_split(p_from timestamptz, p_to timestamptz)
returns table (order_type public.order_type, orders bigint, revenue_paise bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.assert_analytics_access();
  return query
  select o.order_type, count(*)::bigint, sum(o.total_paise)::bigint
    from public.orders o
   where public.is_revenue_status(o.status)
     and coalesce(o.paid_at, o.created_at) >= p_from and coalesce(o.paid_at, o.created_at) < p_to
   group by o.order_type
   order by 3 desc;
end $$;

-- Customers (contact info masked) ---------------------------------------------------
create or replace function public.analytics_customer_stats(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = public, auth as $$
declare result jsonb;
begin
  perform public.assert_analytics_access();
  with period as (
    select o.user_id, count(*) as n, sum(o.total_paise) as rev
      from public.orders o
     where public.is_revenue_status(o.status)
       and coalesce(o.paid_at, o.created_at) >= p_from and coalesce(o.paid_at, o.created_at) < p_to
     group by o.user_id
  ), firsts as (
    select o.user_id, min(coalesce(o.paid_at, o.created_at)) as first_at
      from public.orders o where public.is_revenue_status(o.status)
     group by o.user_id
  ), top as (
    select p.user_id, pr.full_name, public.mask_phone(pr.phone) as phone, public.mask_email(u.email) as email, p.n, p.rev
      from period p
      join public.profiles pr on pr.user_id = p.user_id
      left join auth.users u on u.id = p.user_id
     order by p.rev desc limit 5
  )
  select jsonb_build_object(
    'total_customers', (select count(*) from period),
    'new_customers', (select count(*) from period p join firsts f using (user_id) where f.first_at >= p_from),
    'returning_customers', (select count(*) from period p join firsts f using (user_id) where f.first_at < p_from),
    'repeat_rate_percent', (select case when count(*) > 0 then round(100.0 * count(*) filter (where n >= 2) / count(*), 1) else 0 end from period),
    'avg_orders_per_customer', (select coalesce(round(avg(n), 2), 0) from period),
    'top_customers', coalesce((select jsonb_agg(jsonb_build_object(
        'name', full_name, 'phone', phone, 'email', email, 'orders', n, 'revenue_paise', rev)) from top), '[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.analytics_coupon_performance(p_from timestamptz, p_to timestamptz)
returns table (code text, orders bigint, discount_paise bigint, revenue_paise bigint, avg_order_paise bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.assert_analytics_access();
  return query
  select o.coupon_code, count(*)::bigint, sum(o.discount_paise)::bigint, sum(o.total_paise)::bigint,
         (sum(o.total_paise) / count(*))::bigint
    from public.orders o
   where o.coupon_code is not null and public.is_revenue_status(o.status)
     and coalesce(o.paid_at, o.created_at) >= p_from and coalesce(o.paid_at, o.created_at) < p_to
   group by o.coupon_code
   order by 2 desc;
end $$;

create or replace function public.analytics_period_summary(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  perform public.assert_analytics_access();
  select jsonb_build_object(
    'revenue_paise', coalesce(sum(o.total_paise) filter (where public.is_revenue_status(o.status)), 0),
    'orders', count(*) filter (where public.is_revenue_status(o.status)),
    'aov_paise', coalesce((sum(o.total_paise) filter (where public.is_revenue_status(o.status)))
                  / nullif(count(*) filter (where public.is_revenue_status(o.status)), 0), 0),
    'customers', count(distinct o.user_id) filter (where public.is_revenue_status(o.status)),
    'cancelled', count(*) filter (where o.status = 'cancelled'),
    'discount_paise', coalesce(sum(o.discount_paise) filter (where public.is_revenue_status(o.status)), 0),
    'items_sold', coalesce((select sum(oi.qty) from public.order_items oi join public.orders x on x.id = oi.order_id
                   where public.is_revenue_status(x.status)
                     and coalesce(x.paid_at, x.created_at) >= p_from and coalesce(x.paid_at, x.created_at) < p_to), 0),
    'avg_rating', (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.created_at >= p_from and r.created_at < p_to)
  ) into result
  from public.orders o
  where coalesce(o.paid_at, o.created_at) >= p_from and coalesce(o.paid_at, o.created_at) < p_to;
  return result;
end $$;

create or replace function public.analytics_compare_periods(p_from_a timestamptz, p_to_a timestamptz, p_from_b timestamptz, p_to_b timestamptz)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_analytics_access();
  return jsonb_build_object(
    'a', public.analytics_period_summary(p_from_a, p_to_a),
    'b', public.analytics_period_summary(p_from_b, p_to_b)
  );
end $$;

create or replace function public.analytics_ratings(p_from timestamptz, p_to timestamptz)
returns table (menu_item_id uuid, name text, avg_rating numeric, reviews bigint, positive bigint, neutral bigint, negative bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.assert_analytics_access();
  return query
  select r.menu_item_id, coalesce(m.name, 'Overall order experience'),
         round(avg(r.rating)::numeric, 2), count(*)::bigint,
         count(*) filter (where coalesce(r.sentiment, case when r.rating >= 4 then 'positive' when r.rating = 3 then 'neutral' else 'negative' end::public.review_sentiment) = 'positive')::bigint,
         count(*) filter (where coalesce(r.sentiment, case when r.rating >= 4 then 'positive' when r.rating = 3 then 'neutral' else 'negative' end::public.review_sentiment) = 'neutral')::bigint,
         count(*) filter (where coalesce(r.sentiment, case when r.rating >= 4 then 'positive' when r.rating = 3 then 'neutral' else 'negative' end::public.review_sentiment) = 'negative')::bigint
    from public.reviews r
    left join public.menu_items m on m.id = r.menu_item_id
   where r.created_at >= p_from and r.created_at < p_to
   group by r.menu_item_id, m.name
   order by 4 desc;
end $$;

create or replace function public.analytics_cancellations(p_from timestamptz, p_to timestamptz)
returns table (reason text, orders bigint, value_paise bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.assert_analytics_access();
  return query
  select coalesce(o.cancelled_reason, 'unspecified'), count(*)::bigint, sum(o.total_paise)::bigint
    from public.orders o
   where o.status in ('cancelled', 'refunded')
     and o.created_at >= p_from and o.created_at < p_to
   group by 1
   order by 2 desc;
end $$;

create or replace function public.analytics_payment_methods(p_from timestamptz, p_to timestamptz)
returns table (method text, payments bigint, amount_paise bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.assert_analytics_access();
  return query
  select coalesce(p.method, 'unknown'), count(*)::bigint, sum(p.amount_paise)::bigint
    from public.payments p
    join public.orders o on o.id = p.order_id
   where p.status = 'captured'
     and coalesce(o.paid_at, o.created_at) >= p_from and coalesce(o.paid_at, o.created_at) < p_to
   group by 1
   order by 3 desc;
end $$;

-- Per-item daily quantities (forecasting + sales-drop alerts) ------------------------
create or replace function public.analytics_item_daily(p_from timestamptz, p_to timestamptz)
returns table (day date, menu_item_id uuid, name text, qty bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare tz text := public.restaurant_tz();
begin
  perform public.assert_analytics_access();
  return query
  select (coalesce(o.paid_at, o.created_at) at time zone tz)::date, m.id, m.name, sum(oi.qty)::bigint
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    join public.menu_items m on m.id = oi.menu_item_id
   where public.is_revenue_status(o.status)
     and coalesce(o.paid_at, o.created_at) >= p_from and coalesce(o.paid_at, o.created_at) < p_to
   group by 1, 2, 3
   order by 1, 2;
end $$;

do $$
declare f text;
begin
  for f in
    select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and (p.proname like 'analytics\_%' or p.proname = 'assert_analytics_access')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;
