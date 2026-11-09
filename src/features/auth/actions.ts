"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { localePath } from "@/i18n/routing";

export async function signIn(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "vi";
  const login = localePath(locale, "/login");
  if (!supabaseConfigured()) redirect(`${login}?error=setup_required`);
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || email.length > 254 || !password) redirect(`${login}?error=auth_failed`);

  const client = await createClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) redirect(`${login}?error=auth_failed`);

  const { data: units, error: accessError } = await client.rpc("get_access_context", {});
  if (accessError || !Array.isArray(units) || !units.length) {
    await client.auth.signOut();
    redirect(`${login}?error=${accessError ? "auth_failed" : "not_allowlisted"}`);
  }
  redirect(localePath(locale));
}

export async function signOut(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "vi";
  if (supabaseConfigured()) {
    const client = await createClient();
    await client.auth.signOut();
  }
  redirect(localePath(locale, "/login"));
}
