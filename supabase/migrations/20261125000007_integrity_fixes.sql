-- =============================================================================
-- Integrity fixes
-- 1. A payment for the wrong amount never marks an order paid.
-- 2. Two reservations can never hold the same table at the same time.
-- 3. Coupons created for an email campaign only work for the people it was sent to.
-- 4. Browsers have read-only access: every write already goes through the server.
-- 5. Seeded cartoon dish art is gone; dishes without a photo have no image.
-- =============================================================================

-- 1. Amount mismatch -----------------------------------------------------------
-- The capture is still recorded (so it can be refunded) and the owner is alerted,
-- but the order stays unpaid and stock is untouched.
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

  if p_amount_paise <> o.total_paise then
    insert into public.owner_alerts (type, title, body, severity, data, dedupe_key)
    values ('payment_mismatch', 'Payment amount mismatch',
            format('Order %s: paid %s paise, expected %s paise. The order was NOT marked paid; refund payment %s in Razorpay.',
                   o.order_number, p_amount_paise, o.total_paise, p_razorpay_payment_id),
            'critical', jsonb_build_object('order_id', o.id), 'payment-mismatch-' || p_razorpay_payment_id)
    on conflict (dedupe_key) do nothing;
    return jsonb_build_object('ok', false, 'reason', 'amount_mismatch', 'order_id', o.id);
  end if;

  if o.status not in ('awaiting_payment', 'payment_failed', 'cancelled') then
    return jsonb_build_object('ok', true, 'duplicate', true, 'order_id', o.id);
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
revoke all on function public.mark_order_paid(text, text, int, text, jsonb) from public, anon, authenticated;
grant execute on function public.mark_order_paid(text, text, int, text, jsonb) to service_role;

-- 2. No double-booked tables ---------------------------------------------------
-- Bookings hold a table for 90 minutes (SLOT_MINUTES in lib/services/account.ts).
-- The per-table lock makes two simultaneous bookings queue instead of racing.
create or replace function public.guard_reservation_slot() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.table_number is null or new.status not in ('requested', 'confirmed', 'seated') then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('reservation-table'), new.table_number);
  if exists (
    select 1 from public.reservations r
     where r.table_number = new.table_number
       and r.id <> new.id
       and r.status in ('requested', 'confirmed', 'seated')
       and r.reserved_for > new.reserved_for - interval '90 minutes'
       and r.reserved_for < new.reserved_for + interval '90 minutes'
  ) then
    raise exception 'table % is already booked around that time', new.table_number using errcode = '23P01';
  end if;
  return new;
end $$;

create trigger guard_reservation_slot
  before insert or update of table_number, reserved_for, status on public.reservations
  for each row execute function public.guard_reservation_slot();

-- 3. Campaign coupons are private ----------------------------------------------
alter table public.coupons add column if not exists is_private boolean not null default false;
comment on column public.coupons.is_private is
  'Created for an email campaign: only people that campaign was sent to may see or use it.';
update public.coupons c set is_private = true
 where exists (select 1 from public.email_drafts d where d.coupon_id = c.id);
create index if not exists email_drafts_coupon_idx on public.email_drafts (coupon_id);

drop policy coupons_public_read on public.coupons;
create policy coupons_public_read on public.coupons for select
  using ((is_active and not is_private and not is_draft) or public.is_staff_or_owner());

-- 4. Read-only browsers --------------------------------------------------------
-- The browser client is used for sign-in and realtime only. Removing write grants
-- closes direct /rest/v1 writes (a customer choosing their own table number, or
-- writing the "owner reply" on their own review).
drop policy reservations_own_insert on public.reservations;
drop policy reservations_own_cancel on public.reservations;
drop policy reviews_insert_own on public.reviews;
drop policy profiles_update_own on public.profiles;
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke update (full_name, phone, dietary_prefs, spice_tolerance, allergies, default_address_id)
  on public.profiles from authenticated;

-- 5. Photos --------------------------------------------------------------------
update public.menu_items set image_url = null where image_url like '/dishes/%.svg';
