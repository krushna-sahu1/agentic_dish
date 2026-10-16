-- =============================================================================
-- Supabase pg_cron + pg_net setup for Agentic Dish scheduled jobs.
--
-- Run once in the Supabase SQL Editor. Not a migration.
--
-- This replaces Vercel Cron (vercel.json has no crons so the deploy stays on the
-- Hobby plan). pg_cron fires on a schedule and pg_net makes the HTTP request to
-- the existing GET handlers under app/api/cron/*, authenticating with
-- `Authorization: Bearer <CRON_SECRET>`.
--
-- Before running: replace the two placeholders below with your real values.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;


-- -----------------------------------------------------------------------------
-- 2. Secrets in Supabase Vault (safe to re-run: creates or updates)
--    - cron_site_url : base site URL, NO trailing slash, e.g. https://YOUR-SITE.vercel.app
--    - cron_secret   : must equal the CRON_SECRET env var in Vercel
-- -----------------------------------------------------------------------------
do $$
declare
  v_id uuid;
begin
  -- cron_site_url
  select id into v_id from vault.secrets where name = 'cron_site_url';
  if v_id is null then
    perform vault.create_secret(
      'REPLACE_WITH_YOUR_SITE_URL',
      'cron_site_url',
      'Agentic Dish base site URL (no trailing slash)'
    );
  else
    perform vault.update_secret(
      v_id,
      'REPLACE_WITH_YOUR_SITE_URL',
      'cron_site_url',
      'Agentic Dish base site URL (no trailing slash)'
    );
  end if;

  -- cron_secret
  select id into v_id from vault.secrets where name = 'cron_secret';
  if v_id is null then
    perform vault.create_secret(
      'REPLACE_WITH_YOUR_CRON_SECRET',
      'cron_secret',
      'Must equal CRON_SECRET in Vercel'
    );
  else
    perform vault.update_secret(
      v_id,
      'REPLACE_WITH_YOUR_CRON_SECRET',
      'cron_secret',
      'Must equal CRON_SECRET in Vercel'
    );
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- 3. Helper: read the secrets from Vault and GET <site_url><path>
--    SECURITY DEFINER + empty search_path (every name fully-qualified) so the
--    secrets are only usable from this locked-down function. The default pg_net
--    timeout is too short; the routes have maxDuration 60 so we allow 60000 ms.
-- -----------------------------------------------------------------------------
create or replace function public.call_app_cron(path text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site_url    text;
  v_cron_secret text;
  v_request_id  bigint;
begin
  select decrypted_secret into v_site_url
    from vault.decrypted_secrets where name = 'cron_site_url';
  select decrypted_secret into v_cron_secret
    from vault.decrypted_secrets where name = 'cron_secret';

  if v_site_url is null or v_cron_secret is null then
    raise exception 'Missing vault secrets "cron_site_url" / "cron_secret" — run supabase/cron-setup.sql';
  end if;

  select net.http_get(
    url                    := v_site_url || path,
    headers                := pg_catalog.jsonb_build_object('Authorization', 'Bearer ' || v_cron_secret),
    timeout_milliseconds   := 60000
  ) into v_request_id;

  return v_request_id;
end;
$$;

-- Only the database owner / pg_cron may run this.
revoke execute on function public.call_app_cron(text) from public;
revoke execute on function public.call_app_cron(text) from anon;
revoke execute on function public.call_app_cron(text) from authenticated;


-- -----------------------------------------------------------------------------
-- 4. Schedules (each is unscheduled first, so this script is safe to re-run)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cron-daily-summary') then
    perform cron.unschedule('cron-daily-summary');
  end if;
  if exists (select 1 from cron.job where jobname = 'cron-alerts') then
    perform cron.unschedule('cron-alerts');
  end if;
  if exists (select 1 from cron.job where jobname = 'cron-expire-unpaid') then
    perform cron.unschedule('cron-expire-unpaid');
  end if;
end $$;

-- 02:30 UTC = 08:00 IST
select cron.schedule(
  'cron-daily-summary',
  '30 2 * * *',
  $job$select public.call_app_cron('/api/cron/daily-summary')$job$
);

-- hourly
select cron.schedule(
  'cron-alerts',
  '0 * * * *',
  $job$select public.call_app_cron('/api/cron/alerts')$job$
);

-- every 10 minutes
select cron.schedule(
  'cron-expire-unpaid',
  '*/10 * * * *',
  $job$select public.call_app_cron('/api/cron/expire-unpaid')$job$
);


-- =============================================================================
-- VERIFY (run manually in the SQL Editor)
-- =============================================================================
-- select * from cron.job;
-- select * from cron.job_run_details order by start_time desc limit 20;
-- select id, status_code, error_msg, created from net._http_response order by created desc limit 20;


-- =============================================================================
-- UNDO (run manually to remove the schedules)
-- =============================================================================
-- select cron.unschedule('cron-daily-summary');
-- select cron.unschedule('cron-alerts');
-- select cron.unschedule('cron-expire-unpaid');
