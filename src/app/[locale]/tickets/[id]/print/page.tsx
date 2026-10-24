import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/permissions/context";
import { requireData } from "@/lib/supabase/query";
import { Receipt } from "@/features/tickets/receipt";
import type { Event } from "@/lib/supabase/types";
export default async function TicketPrintPage({params}:{params:Promise<{id:string}>}) {
  const [w,{id}]=await Promise.all([getWorkspace(),params]);
  if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
  const {data:ticket,error}=await w.client.from("tickets").select("*").eq("id",id).maybeSingle();if(error)throw new Error("app.load_failed");if(!ticket)notFound();
  const [event,orders,history]=await Promise.all([
    requireData<Event>(w.client.from("events").select("*").eq("id",ticket.event_id).single<Event>()),
    requireData(w.client.from("orders").select("id").eq("ticket_id",id).is("deleted_at",null).neq("payment_status","cancelled")),
    requireData(w.client.from("ticket_transitions").select("*").eq("ticket_id",id).order("created_at")),
  ]);
  const items=orders.length?await requireData(w.client.from("order_items").select("*").in("order_id",orders.map(row=>row.id)).is("voided_at",null).order("created_at")):[];
  return <Receipt ticket={ticket} event={event} items={items} history={history}/>;
}
