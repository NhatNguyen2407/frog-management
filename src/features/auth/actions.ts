"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { localePath } from "@/i18n/routing";
export async function signIn(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "vi";
  if (!supabaseConfigured()) redirect(localePath(locale, "/login?error=setup_required"));
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) redirect(localePath(locale, "/login?error=setup_required"));
  const client = await createClient();
  const callback = new URL("/auth/callback", site);
  callback.searchParams.set("locale", locale);
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect(localePath(locale, "/login?error=auth_failed"));
  redirect(data.url);
}
export async function signOut(form: FormData) {
  const locale = form.get("locale") === "en" ? "en" : "vi";
  if (supabaseConfigured()) {
    const client = await createClient();
    await client.auth.signOut();
  }
  redirect(localePath(locale, "/login"));
}
