begin;

create or replace function private.set_ticket_status(p_ticket_id uuid, p_status public.ticket_status) returns void
language plpgsql security definer set search_path = '' as $$
declare ticket_row public.tickets; expected_status public.ticket_status;
begin
  select * into ticket_row from public.tickets where id = p_ticket_id;
  if not found then raise exception 'app.not_found' using errcode = 'P0002'; end if;
  perform private.require_member(ticket_row.business_unit_id);
  -- Payment/attendance paths lock orders before the ticket too.
  perform 1 from public.orders where ticket_id = p_ticket_id order by id for update;
  select * into ticket_row from public.tickets where id = p_ticket_id for update;
  if p_status = ticket_row.status then return; end if;
  expected_status := case ticket_row.status when 'registered' then 'waiting'::public.ticket_status
    when 'ticket_printed' then 'waiting'::public.ticket_status
    when 'waiting' then 'in_progress'::public.ticket_status
    when 'in_progress' then 'completed'::public.ticket_status else null end;
  if p_status = 'cancelled' and ticket_row.status not in ('cancelled', 'completed') then
    update public.tickets set status = p_status where id = p_ticket_id;
  elsif expected_status is not null and p_status = expected_status then
    if not exists (select 1 from public.orders where ticket_id=p_ticket_id and deleted_at is null)
      or exists (select 1 from public.orders where ticket_id=p_ticket_id and deleted_at is null and payment_status<>'paid') then
      raise exception 'app.ticket_payment_required' using errcode='23514';
    end if;
    update public.tickets set status = p_status where id = p_ticket_id;
  else raise exception 'app.invalid_transition' using errcode = '23514'; end if;
end;
$$;

-- Cancellation/refund/archive affects preparation, not the attendance history.
create function private.sync_order_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ticket_row public.tickets;
begin
  if new.ticket_id is null or (new.payment_status is not distinct from old.payment_status
    and new.deleted_at is not distinct from old.deleted_at) then return new; end if;
  if new.payment_status in ('cancelled','refunded') or new.deleted_at is not null then
    select * into ticket_row from public.tickets where id=new.ticket_id for update;
    if new.payment_status='cancelled' and old.payment_status='unpaid'
      and ticket_row.status in ('in_progress','completed') then
      raise exception 'app.ticket_in_progress' using errcode='23514';
    end if;
    if ticket_row.status not in ('cancelled','completed') then
      update public.tickets set status='cancelled' where id=new.ticket_id;
    end if;
  end if;
  return new;
end;
$$;
create trigger sync_order_ticket after update of payment_status, deleted_at on public.orders
for each row execute function private.sync_order_ticket();
revoke all on function private.sync_order_ticket() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
