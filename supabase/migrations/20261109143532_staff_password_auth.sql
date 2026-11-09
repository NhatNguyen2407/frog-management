begin;

-- Staff sign-in uses provisioned email/password accounts, not social OAuth.
create or replace function private.role_for_unit(p_unit uuid) returns public.staff_role
language sql stable security definer set search_path = '' as $$
  select a.role from public.staff_allowlist a
  join auth.users u on u.id = (select auth.uid())
  join public.business_units b on b.id = a.business_unit_id and b.active
  where a.business_unit_id = p_unit and a.active
    and a.email = lower(u.email) and u.email_confirmed_at is not null
    and u.raw_app_meta_data->>'provider' = 'email'
  limit 1;
$$;

-- The Auth Hook restricts account creation to allowlisted email identities.
create or replace function public.before_user_created(event jsonb) returns jsonb
language plpgsql set search_path = '' as $$
begin
  if coalesce(event->'user'->'app_metadata'->>'provider', '') <> 'email'
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

commit;
