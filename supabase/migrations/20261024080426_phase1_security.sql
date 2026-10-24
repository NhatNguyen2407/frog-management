begin;

-- Read the current allowlist, never user-editable metadata or a stale role claim.
create function private.role_for_unit(p_unit uuid) returns public.staff_role
language sql stable security definer set search_path = '' as $$
  select a.role from public.staff_allowlist a
  join auth.users u on u.id = (select auth.uid())
  join public.business_units b on b.id = a.business_unit_id and b.active
  where a.business_unit_id = p_unit and a.active
    and a.email = lower(u.email) and u.email_confirmed_at is not null
    and u.raw_app_meta_data->>'provider' = 'google'
  limit 1;
$$;

create function private.is_member(p_unit uuid) returns boolean
language sql stable set search_path = '' as $$
  select private.role_for_unit(p_unit) is not null;
$$;

create function private.is_owner(p_unit uuid) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(private.role_for_unit(p_unit) = 'owner'::public.staff_role, false);
$$;

create function private.require_member(p_unit uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_member(p_unit) then
    raise exception 'app.not_allowed' using errcode = '42501';
  end if;
end;
$$;

create function private.require_owner(p_unit uuid) returns void
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_owner(p_unit) then
    raise exception 'app.owner_required' using errcode = '42501';
  end if;
end;
$$;

-- Hook runs as supabase_auth_admin, before auth.users contains the new account.
create function public.before_user_created(event jsonb) returns jsonb
language plpgsql set search_path = '' as $$
begin
  if coalesce(event->'user'->'app_metadata'->>'provider', '') <> 'google'
     or not exists (
       select 1 from public.staff_allowlist a
       join public.business_units b on b.id = a.business_unit_id and b.active
       where a.active and a.email = lower(event->'user'->>'email')
     ) then
    return jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'app.not_allowlisted'));
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;
grant select on public.staff_allowlist, public.business_units to supabase_auth_admin;
create policy auth_hook_allowlist on public.staff_allowlist for select to supabase_auth_admin using (true);
create policy auth_hook_units on public.business_units for select to supabase_auth_admin using (true);

-- Scope and identity are immutable, including for owners with multiple units.
create function private.guard_record_scope() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id
    or to_jsonb(new)->>'business_unit_id' is distinct from to_jsonb(old)->>'business_unit_id'
    or to_jsonb(new)->>'event_id' is distinct from to_jsonb(old)->>'event_id' then
    raise exception 'app.scope_immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.guard_product_price() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.sold_at is not null and (
    new.price_vnd <> old.price_vnd or new.sku <> old.sku
    or new.category_id <> old.category_id or new.sold_at is distinct from old.sold_at
  ) then
    raise exception 'app.sold_sku_immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger guard_product_price before update on public.products
for each row execute function private.guard_product_price();

create function private.guard_event_numbering() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.ticket_prefix <> old.ticket_prefix and exists (
    select 1 from public.tickets where event_id = old.id
  ) then
    raise exception 'app.ticket_prefix_locked' using errcode = '23514';
  end if;
  if new.next_ticket_number < old.next_ticket_number then
    raise exception 'app.ticket_counter_immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger guard_event_numbering before update on public.events
for each row execute function private.guard_event_numbering();

create function private.guard_last_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.business_units where id = old.business_unit_id for update;
  if old.active and old.role = 'owner' and (
    not new.active or new.role <> 'owner' or new.email <> old.email
  ) and not exists (
    select 1 from public.staff_allowlist where business_unit_id = old.business_unit_id
      and id <> old.id and active and role = 'owner'
  ) then
    raise exception 'app.last_owner' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger guard_last_owner before update on public.staff_allowlist
for each row execute function private.guard_last_owner();

create function private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare record_data jsonb := to_jsonb(new);
begin
  insert into public.audit_log(business_unit_id, event_id, actor_id, entity_table, entity_id, action, changes)
  values (
    case when tg_table_name = 'business_units' then new.id else (record_data->>'business_unit_id')::uuid end,
    (record_data->>'event_id')::uuid,
    auth.uid(), tg_table_name, new.id, lower(tg_op),
    jsonb_build_object('before', case when tg_op = 'UPDATE' then to_jsonb(old) else null end, 'after', record_data)
  );
  return new;
end;
$$;

create policy units_member_read on public.business_units for select to authenticated
using (private.is_member(id));
create policy units_owner_update on public.business_units for update to authenticated
using (private.is_owner(id)) with check (private.is_owner(id));
grant select on public.business_units to authenticated;
grant update(name) on public.business_units to authenticated;

create policy allowlist_read on public.staff_allowlist for select to authenticated
using (private.is_owner(business_unit_id) or (
  private.is_member(business_unit_id) and email = lower((select auth.jwt()->>'email'))
));
create policy allowlist_owner_insert on public.staff_allowlist for insert to authenticated
with check (private.is_owner(business_unit_id));
create policy allowlist_owner_update on public.staff_allowlist for update to authenticated
using (private.is_owner(business_unit_id)) with check (private.is_owner(business_unit_id));
grant select, insert on public.staff_allowlist to authenticated;
grant update(email, role, active) on public.staff_allowlist to authenticated;

do $$
declare table_name text;
begin
  -- Staff can read operational data; all direct writes use owner policies or atomic RPCs.
  foreach table_name in array array[
    'events','product_categories','products','event_products','tickets',
    'ticket_transitions','queue_entries','orders','order_items'
  ] loop
    execute format('create policy member_read on public.%I for select to authenticated using (private.is_member(business_unit_id))', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
  end loop;

  foreach table_name in array array[
    'product_costs','order_item_financials','inventory_items','event_inventory',
    'product_inventory_links','order_item_inventory','inventory_movements','costs','audit_log'
  ] loop
    execute format('create policy owner_read on public.%I for select to authenticated using (private.is_owner(business_unit_id))', table_name);
    execute format('grant select on public.%I to authenticated', table_name);
  end loop;

  foreach table_name in array array[
    'product_categories','event_products','inventory_items','event_inventory','product_inventory_links','costs'
  ] loop
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (private.is_owner(business_unit_id))', table_name);
    execute format('create policy owner_update on public.%I for update to authenticated using (private.is_owner(business_unit_id)) with check (private.is_owner(business_unit_id))', table_name);
    execute format('grant insert, update on public.%I to authenticated', table_name);
  end loop;

  foreach table_name in array array[
    'business_units','staff_allowlist','events','product_categories','products','product_costs',
    'event_products','tickets','orders','order_items','inventory_items','event_inventory',
    'product_inventory_links','costs'
  ] loop
    execute format('create trigger audit_change after insert or update on public.%I for each row execute function private.audit_change()', table_name);
    execute format('create trigger guard_record_scope before update on public.%I for each row execute function private.guard_record_scope()', table_name);
  end loop;
end;
$$;

-- Events are inserted by create_event, which also initializes products and stock.
create policy events_owner_update on public.events for update to authenticated
using (private.is_owner(business_unit_id)) with check (private.is_owner(business_unit_id));
grant update(name, event_date, status, capacity, ticket_prefix) on public.events to authenticated;

-- A soft-deleted order is hidden from normal staff reads; owners retain its audit trail.
drop policy member_read on public.orders;
create policy orders_read on public.orders for select to authenticated
using (private.is_member(business_unit_id) and (deleted_at is null or private.is_owner(business_unit_id)));
drop policy member_read on public.order_items;
create policy order_items_read on public.order_items for select to authenticated
using (private.is_member(business_unit_id) and exists (
  select 1 from public.orders o where o.id = order_id and (o.deleted_at is null or private.is_owner(o.business_unit_id))
));

-- Revocation applies to Realtime too, because its SELECT policies check the live allowlist.
-- Cancelled queue rows remain readable to deliver the removal update; screens filter them out.
alter publication supabase_realtime add table public.queue_entries;

grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.role_for_unit(uuid), private.is_member(uuid), private.is_owner(uuid),
  private.require_member(uuid), private.require_owner(uuid) to authenticated;
alter default privileges in schema private revoke execute on functions from public;

commit;
