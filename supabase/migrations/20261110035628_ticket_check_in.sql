begin;

alter table public.tickets add column checked_in_at timestamptz;

create or replace trigger sync_ticket after insert or update of status, customer_name on public.tickets
for each row execute function private.sync_ticket();

create view public.ticket_registrations with (security_invoker = true) as
select t.*,
  t.status <> 'cancelled'
  and exists (select 1 from public.orders o where o.ticket_id = t.id and o.deleted_at is null)
  and not exists (
    select 1 from public.orders o where o.ticket_id = t.id and o.deleted_at is null
      and o.payment_status <> 'paid'
  ) as can_check_in
from public.tickets t;

revoke all on public.ticket_registrations from public, anon, authenticated;
grant select on public.ticket_registrations to authenticated;

create function private.set_ticket_check_in(p_ticket_id uuid, p_event_id uuid, p_checked_in boolean)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare ticket_row public.tickets; checked_at timestamptz;
begin
  if p_checked_in is null then raise exception 'app.invalid_request' using errcode = '23514'; end if;
  select * into ticket_row from public.tickets where id = p_ticket_id and event_id = p_event_id;
  if not found then raise exception 'app.not_found' using errcode = 'P0002'; end if;
  perform private.require_member(ticket_row.business_unit_id);

  -- Lock payments before the ticket so attendance cannot race a refund or cancellation.
  perform 1 from public.orders where ticket_id = p_ticket_id order by id for update;
  select * into ticket_row from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'app.not_found' using errcode = 'P0002'; end if;
  if not (select can_check_in from public.ticket_registrations where id = p_ticket_id) then
    raise exception 'app.check_in_unavailable' using errcode = '23514';
  end if;
  if p_checked_in = (ticket_row.checked_in_at is not null) then return ticket_row.checked_in_at; end if;

  update public.tickets set checked_in_at = case when p_checked_in then now() else null end
  where id = p_ticket_id returning checked_in_at into checked_at;
  return checked_at;
end;
$$;

create function public.set_ticket_check_in(p_ticket_id uuid, p_event_id uuid, p_checked_in boolean)
returns timestamptz language sql security invoker set search_path = '' as $$
  select private.set_ticket_check_in(p_ticket_id, p_event_id, p_checked_in);
$$;

revoke all on function private.set_ticket_check_in(uuid,uuid,boolean),
  public.set_ticket_check_in(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function private.set_ticket_check_in(uuid,uuid,boolean),
  public.set_ticket_check_in(uuid,uuid,boolean) to authenticated;

commit;
