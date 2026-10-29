import { defineRouting } from "next-intl/routing";
export const routing = defineRouting({
  locales: ["vi", "en"],
  defaultLocale: "vi",
  localePrefix: "always",
  localeDetection: false,
});

export function localePath(locale: string, path = "/") {
  return `/${locale === "en" ? "en" : "vi"}${path === "/" ? "" : path}`;
}
