import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import "./globals.css";
export async function generateMetadata() { const t = await getTranslations("common"); return { title: `${t("appName")} · ${t("appSubtitle")}`, description: t("appSubtitle"), robots: { index: false, follow: false } }; }
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [locale, messages, store] = await Promise.all([getLocale(), getMessages(), cookies()]);
  return <html lang={locale} className={store.get("frog-theme")?.value === "dark" ? "dark" : ""} suppressHydrationWarning><body><NextIntlClientProvider messages={messages} timeZone="Asia/Ho_Chi_Minh">{children}</NextIntlClientProvider></body></html>;
}
