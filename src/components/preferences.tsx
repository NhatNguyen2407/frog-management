"use client";
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Moon, Sun, Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "./ui/button";
export function Preferences() {
  const t = useTranslations("common"); const locale = useLocale(); const pathname = usePathname(); const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => { document.documentElement.lang = locale; setDark(document.documentElement.classList.contains("dark")); }, [locale]);
  function theme() {
    const value = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", value);
    document.cookie = `frog-theme=${value ? "dark" : "light"};Path=/;Max-Age=31536000;SameSite=Lax${location.protocol === "https:" ? ";Secure" : ""}`;
    setDark(value);
  }
  return <div className="flex items-center gap-1"><Button variant="ghost" size="icon" onClick={theme} aria-label={t(dark ? "light" : "dark")}><Sun className="hidden dark:block" /><Moon className="dark:hidden" /></Button><Button variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(() => router.replace(pathname, { locale: locale === "vi" ? "en" : "vi" }))}><Languages aria-hidden />{t(locale === "vi" ? "languageEn" : "languageVi")}</Button></div>;
}
