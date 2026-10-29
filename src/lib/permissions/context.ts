import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { localePath } from "@/i18n/routing";
import type { Membership } from "@/lib/supabase/types";

export const getWorkspace = cache(async () => {
  const locale = await getLocale();
  if (!supabaseConfigured()) redirect(localePath(locale, "/login"));
  const client = await createClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user) redirect(localePath(locale, "/login"));
  const { data, error } = await client.rpc("get_access_context", {});
  if (error) throw new Error("app.load_failed");
  const units = (data ?? []) as unknown as Membership[];
  if (!units.length) redirect(localePath(locale, "/login?error=not_allowlisted"));
  const store = await cookies();
  const unit = units.find((item) => item.id === store.get("frog-unit")?.value) ?? units[0];
  const eventsResult = await client
    .from("events")
    .select("*")
    .eq("business_unit_id", unit.id)
    .order("event_date", { ascending: false });
  if (eventsResult.error) throw new Error("app.load_failed");
  const events = eventsResult.data;
  const event =
    events.find((item) => item.id === store.get("frog-event")?.value) ??
    events.find((item) => item.status === "active") ??
    events[0] ??
    null;
  return { client, user, units, unit, events, event, locale, owner: unit.role === "owner" };
});
