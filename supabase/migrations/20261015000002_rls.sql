-- =============================================================================
-- Row Level Security
-- Customers: read menu/settings; CRUD own cart/addresses/favorites/reservations;
--            read own orders/payments; review own completed orders.
-- Staff/owner: read everything. All writes go through server tools (service role)
--              after a role check in lib/agents/guard.ts.
-- payments + the transition to `paid` are writable only by the webhook (service role).
-- =============================================================================

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Profiles -------------------------------------------------------------------
create policy profiles_select_own on public.profiles for select
  using (user_id = auth.uid() or public.is_staff_or_owner());
create policy profiles_update_own on public.profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, dietary_prefs, spice_tolerance, allergies, default_address_id)
  on public.profiles to authenticated;

-- Addresses ------------------------------------------------------------------
create policy addresses_own on public.addresses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_staff_read on public.addresses for select using (public.is_staff_or_owner());

-- Menu (public read) -------------------------------------------------------------
create policy categories_public_read on public.categories for select
  using (is_active or public.is_staff_or_owner());
create policy menu_items_public_read on public.menu_items for select
  using (not is_deleted or public.is_staff_or_owner());
create policy item_variants_public_read on public.item_variants for select using (true);
create policy item_addons_public_read on public.item_addons for select using (true);
create policy pairings_public_read on public.pairings for select using (true);
create policy settings_public_read on public.restaurant_settings for select using (true);
create policy tables_public_read on public.tables for select using (true);
create policy coupons_public_read on public.coupons for select
  using (is_active or public.is_staff_or_owner());

-- Cart -----------------------------------------------------------------------
create policy carts_own on public.carts for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_own on public.cart_items for all
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));

-- Orders (read-only for clients; created server-side) ------------------------------
create policy orders_read on public.orders for select
  using (user_id = auth.uid() or public.is_staff_or_owner());
create policy order_items_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id
                  and (o.user_id = auth.uid() or public.is_staff_or_owner())));
create policy order_status_events_read on public.order_status_events for select
  using (exists (select 1 from public.orders o where o.id = order_id
                  and (o.user_id = auth.uid() or public.is_staff_or_owner())));
create policy payments_read on public.payments for select
  using (exists (select 1 from public.orders o where o.id = order_id
                  and (o.user_id = auth.uid() or public.is_staff_or_owner())));
create policy refunds_read on public.refunds for select
  using (exists (select 1 from public.orders o where o.id = order_id
                  and (o.user_id = auth.uid() or public.is_owner())));
create policy coupon_redemptions_read on public.coupon_redemptions for select
  using (user_id = auth.uid() or public.is_staff_or_owner());

-- Reservations -------------------------------------------------------------------
create policy reservations_own_read on public.reservations for select
  using (user_id = auth.uid() or public.is_staff_or_owner());
create policy reservations_own_insert on public.reservations for insert
  with check (user_id = auth.uid() and status = 'requested');
create policy reservations_own_cancel on public.reservations for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and status in ('requested', 'cancelled'));

-- Reviews: only on own completed orders ------------------------------------------
create policy reviews_read on public.reviews for select
  using (user_id = auth.uid() or public.is_staff_or_owner());
create policy reviews_insert_own on public.reviews for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid() and o.status = 'completed')
  );

-- Favorites ------------------------------------------------------------------------
create policy favorites_own on public.favorites for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Inventory (staff read) -------------------------------------------------------------
create policy inventory_staff_read on public.inventory_items for select using (public.is_staff_or_owner());
create policy recipe_staff_read on public.recipe_ingredients for select using (public.is_staff_or_owner());

-- Agent data ---------------------------------------------------------------------
create policy agent_conversations_own on public.agent_conversations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy agent_messages_own on public.agent_messages for all
  using (exists (select 1 from public.agent_conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.agent_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy audit_owner_read on public.agent_audit_log for select using (public.is_owner());
create policy alerts_staff_read on public.owner_alerts for select using (public.is_staff_or_owner());

-- order_counters, rate_limits: no client policies (service role only).

-- Realtime ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.orders, public.order_status_events, public.carts, public.cart_items,
      public.menu_items, public.owner_alerts, public.restaurant_settings;
  end if;
end $$;

alter table public.orders replica identity full;
alter table public.cart_items replica identity full;
alter table public.menu_items replica identity full;
