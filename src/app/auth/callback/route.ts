import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { localePath } from "@/i18n/routing";
export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale") === "en" ? "en" : "vi";
  const code = request.nextUrl.searchParams.get("code");
  const destination = new URL(localePath(locale, "/login?error=auth_failed"), request.url);
  if (code) {
    const client = await createClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data, error: accessError } = await client.rpc("get_access_context", {});
      if (!accessError && Array.isArray(data) && data.length) return NextResponse.redirect(new URL(localePath(locale), request.url));
      await client.auth.signOut();
      destination.searchParams.set("error", "not_allowlisted");
    }
  }
  return NextResponse.redirect(destination);
}
