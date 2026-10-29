import { getTranslations } from "next-intl/server";
import { Leaf, ArrowRight, ShieldCheck, CircleDot } from "lucide-react";
import { signIn } from "@/features/auth/actions";
import { supabaseConfigured } from "@/lib/supabase/config";
import { Preferences } from "@/components/preferences";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [t, c, errors, { locale }, query] = await Promise.all([
    getTranslations("login"),
    getTranslations("common"),
    getTranslations("errors"),
    params,
    searchParams,
  ]);
  const configured = supabaseConfigured();
  const error =
    query.error && ["not_allowlisted", "auth_failed", "setup_required"].includes(query.error)
      ? query.error
      : query.error
        ? "auth_failed"
        : null;
  return (
    <main className="relative grid min-h-dvh lg:grid-cols-2">
      <section className="relative flex min-h-0 flex-col lg:min-h-dvh justify-between overflow-hidden bg-[#e5ecdd] p-7 text-[#234631] sm:p-12 lg:p-16 dark:bg-[#21382a] dark:text-[#dce9d7]">
        <div className="relative z-10 flex items-center gap-3">
          <div className="rounded-2xl bg-[#234631] p-3 text-white">
            <Leaf className="size-6" aria-hidden />
          </div>
          <div>
            <p className="text-xl font-semibold tracking-tight">{c("appName")}</p>
            <p className="text-xs tracking-widest opacity-70">{c("appSubtitle")}</p>
          </div>
        </div>
        <div className="relative z-10 my-12 hidden max-w-xl lg:my-24 lg:block">
          <p className="mb-6 text-xs font-bold tracking-[0.2em] opacity-70">{t("eyebrow")}</p>
          <h1 className="whitespace-pre-line text-4xl font-medium leading-[1.2] tracking-tight sm:text-5xl xl:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-sm text-base leading-relaxed opacity-80">{t("body")}</p>
        </div>
        <p className="relative z-10 hidden text-xs opacity-75 lg:block">{t("footer")}</p>
        <div
          aria-hidden
          className="absolute -bottom-40 -right-40 size-[480px] rounded-full border-[70px] border-[#244e32]/5 dark:border-white/5"
        />
      </section>
      <section className="flex flex-col px-6 py-5 sm:px-12 lg:px-16">
        <div className="flex justify-end">
          <Preferences />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-14">
          <Badge className="mb-6 self-start" tone="green">
            <ShieldCheck className="size-3.5" aria-hidden />
            {t("private")}
          </Badge>
          <h2 className="text-3xl font-semibold tracking-tight">{t("welcome")}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("signInBody")}</p>
          {error ? (
            <div className="mt-6">
              <Notice variant="error">{errors(error)}</Notice>
            </div>
          ) : null}
          {configured ? (
            <form action={signIn} className="mt-8">
              <input type="hidden" name="locale" value={locale} />
              <Button className="w-full justify-between" type="submit">
                <span className="flex items-center gap-3">
                  <CircleDot aria-hidden />
                  {t("google")}
                </span>
                <ArrowRight aria-hidden />
              </Button>
            </form>
          ) : (
            <div className="mt-8 rounded-2xl border bg-card p-5">
              <Badge tone="amber">{t("setupBadge")}</Badge>
              <h3 className="mt-4 font-semibold">{t("setupTitle")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("setupBody")}</p>
            </div>
          )}
          <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            {t("restricted")}
          </p>
        </div>
      </section>
    </main>
  );
}
