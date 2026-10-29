import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
export async function requireData<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<NonNullable<T>> {
  const result = await query;
  if (result.error || result.data === null) throw new Error("app.load_failed");
  return result.data as NonNullable<T>;
}
export async function loadQueue(client: SupabaseClient<Database>, eventId: string) {
  const results = await Promise.all([
    requireData(
      client
        .from("queue_entries")
        .select("*")
        .eq("event_id", eventId)
        .in("status", ["waiting", "in_progress"])
        .order("sequence_number")
        .limit(500),
    ),
    requireData(
      client
        .from("queue_entries")
        .select("*")
        .eq("event_id", eventId)
        .eq("status", "completed")
        .order("status_changed_at", { ascending: false })
        .limit(20),
    ),
  ]);
  return results.flat();
}
