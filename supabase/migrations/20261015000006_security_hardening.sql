-- =============================================================================
-- Security hardening (Supabase security advisor findings).
-- The app reads these views and calls every RPC through the server's
-- service-role client (lib/supabase/admin.ts), so none of this changes app
-- behaviour; it only closes direct /rest/v1 access that nothing uses.
-- =============================================================================

-- 1. SECURITY DEFINER views (advisor ERROR 0010) --------------------------------
-- Run as the querying role so RLS applies, and drop the anon/authenticated
-- grants: menu stats and public reviews are served by our own server code.
alter view public.menu_item_stats set (security_invoker = true);
alter view public.public_reviews set (security_invoker = true);
revoke all on public.menu_item_stats from anon, authenticated;
revoke all on public.public_reviews from anon, authenticated;
grant select on public.menu_item_stats, public.public_reviews to service_role;
-- security_invoker views need the reader to see the base tables. Supabase already
-- grants these to service_role by default; stated here so the views never depend on it.
grant select on public.menu_items, public.reviews, public.profiles, public.order_items, public.orders to service_role;

-- 2. SECURITY DEFINER functions callable over /rest/v1/rpc (advisor 0028/0029) ---
-- Service role only. Kept callable by everyone: current_app_role(), is_owner()
-- and is_staff_or_owner(), because RLS policies call them as the querying role
-- (anon included, e.g. categories_public_read) and they only reveal the
-- caller's own role. Trigger functions keep firing: EXECUTE is checked only
-- when a trigger is created, not when it fires. The analytics RPCs keep their
-- in-function owner/service-role check as a second layer.
do $$
declare f text;
begin
  for f in
    select p.oid::regprocedure::text
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prosecdef
       and p.proname not in ('current_app_role', 'is_owner', 'is_staff_or_owner')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- 3. Mutable search_path (advisor WARN 0011) -----------------------------------
alter function public.mask_phone(text) set search_path = public;
alter function public.mask_email(text) set search_path = public;
alter function public.guard_profile_role() set search_path = public;
alter function public.guard_order_status() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.is_revenue_status(public.order_status) set search_path = public;

-- 4. RLS enabled with no policies (advisor INFO 0008) — intentional ------------
comment on table public.order_counters is
  'Per-day order number counter. RLS on with no policies on purpose: only next_order_number() (security definer, service role) touches it.';
comment on table public.rate_limits is
  'Agent rate-limit buckets. RLS on with no policies on purpose: only hit_rate_limit() (security definer, service role) touches it.';
